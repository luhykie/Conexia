<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Document;
use App\Models\Notification;
use App\Models\Profile;
use App\Repositories\WorkflowSummaryRepository;
use App\Support\Pagination;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class WorkflowSummaryService
{
    public function __construct(
        private readonly WorkflowSummaryRepository $summaries
    ) {
    }

    public function expiry(Profile $profile, array $options): array
    {
        $documents = $this->summaries
            ->visibleDocuments($profile, $options, expiryOnly: true);

        $records = $documents
            ->map(fn (Document $document): array =>
                $this->expiryRow($document, $profile)
            )
            ->values();

        $expired = $records
            ->where('classification', 'expired')
            ->values();

        $upcoming = $records
            ->where('classification', 'expiring_soon')
            ->values();

        $renewalRequired = $records
            ->filter(fn (array $record): bool =>
                in_array($record['classification'], [
                    'expired',
                    'expiring_soon',
                    'renewal_required',
                ], true)
            )
            ->values();

        $displayRecords = ($options['expiry_window'] ?? null) ||
            ($options['renewal_filter'] ?? null)
                ? $records
                : $renewalRequired;

        return [
            'stats' => [
                'total_expiring_soon' => $upcoming->count(),
                'expired' => $expired->count(),
                'urgent_renewals' => $renewalRequired->count(),
                'awaiting_department_action' =>
                    $renewalRequired->count(),
                'renewed_month_to_date' => $records
                    ->where(
                        'renewal_status',
                        Document::RENEWAL_RENEWED
                    )
                    ->count(),
            ],
            'records' => $displayRecords->all(),
            'upcoming' => $upcoming->all(),
            'expired' => $expired->all(),
            'renewal_required' => $renewalRequired->all(),
            'meta' => Pagination::meta($documents),
        ];
    }

    public function syncExpiryNotifications(): array
    {
        $documents = $this->summaries->documentsWithExpiry();
        $created = 0;

        foreach ($documents as $document) {
            $classification = $this->expiryClassification($document);

            if ($classification === 'expired') {
                $created += $this->createExpiryNotification(
                    $document,
                    'document_expired',
                    'Document Expired',
                    "{$document->tracking_number} has expired."
                );
            }

            if ($classification === 'expiring_soon') {
                $created += $this->createExpiryNotification(
                    $document,
                    'document_expiring_soon',
                    'Document Expiring Soon',
                    "{$document->tracking_number} is inside its renewal notice window."
                );
            }
        }

        return ['created' => $created];
    }

    public function requestRenewal(
        Profile $profile,
        string $documentId
    ): array {
        return DB::transaction(function () use (
            $profile,
            $documentId
        ): array {
            $document = $this->summaries
                ->findVisibleDocumentForUpdate($profile, $documentId);

            if (!$document || !$document->expiry_date) {
                abort(404, 'The requested document could not be found.');
            }

            if (
                !in_array($this->expiryClassification($document), [
                    'expired',
                    'expiring_soon',
                    'renewal_required',
                ], true)
            ) {
                throw ValidationException::withMessages([
                    'document' => 'This document does not require renewal.',
                ]);
            }

            $document->update([
                'renewal_status' => Document::RENEWAL_REQUESTED,
            ]);

            AuditLog::query()->create([
                'actor_id' => $profile->id,
                'document_id' => $document->id,
                'action' => 'document_renewal.requested',
                'metadata' => [
                    'expiry_date' =>
                        $document->expiry_date->toDateString(),
                ],
            ]);

            return $this->expiryRow($document->refresh(), $profile);
        });
    }

    public function archive(array $options): array
    {
        $documents = $this->summaries->archivedDocuments($options);
        $today = now()->toDateString();
        $allArchived = $this->summaries->archivedDocuments();

        return [
            'stats' => [
                'total_archived' => $allArchived->count(),
                'finalized_today' => $allArchived
                    ->filter(fn (Document $document): bool =>
                        $document->archived_at?->toDateString() === $today
                    )
                    ->count(),
                'pending_archival' => $this->summaries
                    ->reportDocuments()
                    ->where('status', Document::STATUS_NOTARIZED)
                    ->count(),
                'audit_flags' => 0,
            ],
            'records' => $documents
                ->map(fn (Document $document): array =>
                    $this->archiveRow($document)
                )
                ->values()
                ->all(),
            'meta' => Pagination::meta($documents),
        ];
    }

    public function reports(array $options): array
    {
        $documents = $this->summaries->reportDocuments([
            ...$options,
            'paginate' => false,
        ]);
        $breakdown = collect($this->departmentBreakdown($documents));
        $page = $options['page'] ?? 1;
        $perPage = $options['per_page'] ?? Pagination::DEFAULT_PER_PAGE;
        $pagedBreakdown = new LengthAwarePaginator(
            $breakdown->forPage($page, $perPage)->values(),
            $breakdown->count(),
            $perPage,
            $page
        );

        $reviewedStatuses = [
            Document::STATUS_CORRECTIONS_NEEDED,
            Document::STATUS_APPROVED,
            Document::STATUS_PENDING_NOTARIZATION,
            Document::STATUS_NOTARIZED,
            Document::STATUS_ARCHIVED,
        ];

        return [
            'stats' => [
                'total_reviewed' =>
                    $this->countIn($documents, $reviewedStatuses),
                'total_returned' => $this->countStatus(
                    $documents,
                    Document::STATUS_CORRECTIONS_NEEDED
                ),
                'total_notarized' => $this->countIn($documents, [
                    Document::STATUS_NOTARIZED,
                    Document::STATUS_ARCHIVED,
                ]),
            ],
            'department_breakdown' =>
                $pagedBreakdown->items(),
            'meta' => Pagination::meta($pagedBreakdown),
        ];
    }

    private function archiveRow(Document $document): array
    {
        return [
            'tracking_number' => $document->tracking_number,
            'partner_institution' =>
                $document->partner_institution ?? '-',
            'document_type' => $document->document_type ?? '-',
            'distribution_date' =>
                $document->archived_at?->toISOString(),
            'completion' => 'Archived',
            'status' => $document->status,
            'id' => $document->id,
        ];
    }

    private function expiryRow(
        Document $document,
        Profile $profile
    ): array
    {
        $document->loadMissing('department');

        $daysRemaining = now()
            ->startOfDay()
            ->diffInDays($document->expiry_date, false);

        $classification = $this->expiryClassification($document);

        if ($profile->role === Profile::ROLE_IRO_STAFF) {
            return [
                'id' => $document->id,
                'tracking_number' => $document->tracking_number,
                'department_id' => $document->department_id,
                'department' => $document->department
                    ? [
                        'id' => $document->department->id,
                        'code' => $document->department->code,
                        'name' => $document->department->name,
                    ]
                    : null,
                'effective_date' =>
                    $document->effective_date?->toDateString(),
                'expiry_date' =>
                    $document->expiry_date?->toDateString(),
                'expiry' => $this->expiryLabel($daysRemaining),
                'days_remaining' => $daysRemaining,
                'renewal_status' => $document->renewal_status,
                'status' => $document->status,
                'workflow_status' => $document->status,
                'classification' => $classification,
                'action' => 'Remind IRO Admin',
            ];
        }

        return [
            'id' => $document->id,
            'tracking_number' => $document->tracking_number,
            'document_name' =>
                $document->title ?? $document->tracking_number,
            'title' => $document->title,
            'document_type' => $document->document_type,
            'partner_institution' =>
                $document->partner_institution ?? '-',
            'effective_date' =>
                $document->effective_date?->toDateString(),
            'expiry_date' =>
                $document->expiry_date?->toDateString(),
            'expiry' => $this->expiryLabel($daysRemaining),
            'days_remaining' => $daysRemaining,
            'renewal_status' => $document->renewal_status,
            'status' => $document->status,
            'workflow_status' => $document->status,
            'classification' => $classification,
            'action' => in_array($classification, [
                'expired',
                'expiring_soon',
                'renewal_required',
            ], true)
                ? 'Initiate Renewal'
                : 'View Document',
        ];
    }

    private function expiryClassification(Document $document): string
    {
        if (
            in_array($document->renewal_status, [
                Document::RENEWAL_DUE,
                Document::RENEWAL_REQUESTED,
            ], true)
        ) {
            return 'renewal_required';
        }

        if (
            $document->renewal_status === Document::RENEWAL_EXPIRED ||
            $document->expiry_date->isPast() &&
                !$document->expiry_date->isToday()
        ) {
            return 'expired';
        }

        $noticeDays = $document->renewal_notice_days ??
            Document::DEFAULT_RENEWAL_NOTICE_DAYS;

        if (
            now()->startOfDay()
                ->addDays($noticeDays)
                ->greaterThanOrEqualTo($document->expiry_date)
        ) {
            return 'expiring_soon';
        }

        return 'active';
    }

    private function expiryLabel(float|int $daysRemaining): string
    {
        if ($daysRemaining < 0) {
            return 'Expired '.abs((int) $daysRemaining).' days ago';
        }

        if ($daysRemaining === 0) {
            return 'Expires today';
        }

        return 'Expires in '.(int) $daysRemaining.' days';
    }

    private function createExpiryNotification(
        Document $document,
        string $type,
        string $title,
        string $message
    ): int {
        if (!$document->submitted_by) {
            return 0;
        }

        $exists = Notification::query()
            ->where('user_id', $document->submitted_by)
            ->where('document_id', $document->id)
            ->where('notification_type', $type)
            ->exists();

        if ($exists) {
            return 0;
        }

        Notification::query()->create([
            'user_id' => $document->submitted_by,
            'document_id' => $document->id,
            'title' => $title,
            'message' => $message,
            'notification_type' => $type,
            'is_read' => false,
        ]);

        return 1;
    }

    private function departmentBreakdown(Collection $documents): array
    {
        return $documents
            ->groupBy('department_id')
            ->map(function (Collection $group): array {
                $department = $group->first()?->department;
                $approved = $this->countIn($group, [
                    Document::STATUS_APPROVED,
                    Document::STATUS_PENDING_NOTARIZATION,
                    Document::STATUS_NOTARIZED,
                    Document::STATUS_ARCHIVED,
                ]);
                $returned = $this->countStatus(
                    $group,
                    Document::STATUS_CORRECTIONS_NEEDED
                );
                $total = $group->count();
                $successRate = $total > 0
                    ? round(($approved / $total) * 100)
                    : 0;

                return [
                    'department' => $department
                        ? "{$department->code} - {$department->name}"
                        : 'Unassigned',
                    'total_requests' => $total,
                    'approved' => $approved,
                    'returned' => $returned,
                    'average_turnaround' => 'Not tracked',
                    'success_rate' => "{$successRate}%",
                ];
            })
            ->values()
            ->all();
    }

    private function countStatus(
        Collection $documents,
        string $status
    ): int {
        return $documents
            ->where('status', $status)
            ->count();
    }

    private function countIn(
        Collection $documents,
        array $statuses
    ): int {
        return $documents
            ->whereIn('status', $statuses)
            ->count();
    }
}
