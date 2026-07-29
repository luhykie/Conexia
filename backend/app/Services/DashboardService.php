<?php

namespace App\Services;

use App\Models\Document;
use App\Models\Profile;
use App\Repositories\DashboardRepository;
use Illuminate\Database\Eloquent\Collection;

class DashboardService
{
    public function __construct(
        private readonly DashboardRepository $dashboards
    ) {
    }

    public function department(Profile $profile): array
    {
        $documents = $this->dashboards
            ->departmentDocuments($profile);

        return [
            'stats' => [
                'active_submissions' => $this->countIn($documents, [
                    Document::STATUS_SUBMITTED,
                    Document::STATUS_LOGGED,
                    Document::STATUS_UNDER_LEGAL_REVIEW,
                ]),
                'pending_corrections' => $this->countStatus(
                    $documents,
                    Document::STATUS_CORRECTIONS_NEEDED
                ),
                'approved_documents' => $this->countIn($documents, [
                    Document::STATUS_APPROVED,
                    Document::STATUS_PENDING_NOTARIZATION,
                    Document::STATUS_NOTARIZED,
                    Document::STATUS_ARCHIVED,
                ]),
                'notarized_documents' => $this->countIn($documents, [
                    Document::STATUS_NOTARIZED,
                    Document::STATUS_ARCHIVED,
                ]),
            ],
            'recent_activity' => $this->recentActivity($documents),
            'notifications' => $this->statusNotices($documents),
            'status_distribution' => $this->statusDistribution($documents),
            'upcoming_expiries' => [],
        ];
    }

    public function iro(): array
    {
        $documents = $this->dashboards->iroDocuments();
        $queueDocuments = $this->dashboards
            ->iroDocuments(includeArchived: false);

        return [
            'stats' => [
                'incoming_submissions' => $this->countStatus(
                    $documents,
                    Document::STATUS_SUBMITTED
                ),
                'under_review' => $this->countStatus(
                    $documents,
                    Document::STATUS_UNDER_LEGAL_REVIEW
                ),
                'assigned_to_legal' => $this->countStatus(
                    $documents,
                    Document::STATUS_UNDER_LEGAL_REVIEW
                ),
                'pending_notarization' => $this->countStatus(
                    $documents,
                    Document::STATUS_PENDING_NOTARIZATION
                ),
                'completed' => $this->countIn($documents, [
                    Document::STATUS_NOTARIZED,
                    Document::STATUS_ARCHIVED,
                ]),
                'archived' => $this->countStatus(
                    $documents,
                    Document::STATUS_ARCHIVED
                ),
                'total_submissions' => $documents->count(),
            ],
            'recent_activity' => $this->recentActivity($queueDocuments),
            'notifications' => $this->statusNotices($queueDocuments),
            'status_distribution' => $this->statusDistribution($documents),
            'trend' => $this->statusTrend($documents),
        ];
    }

    public function legal(Profile $profile): array
    {
        $documents = $this->dashboards
            ->legalDocuments($profile);

        return [
            'stats' => [
                'pending_legal_reviews' => $this->countStatus(
                    $documents,
                    Document::STATUS_UNDER_LEGAL_REVIEW
                ),
                'corrections_needed' => $this->countStatus(
                    $documents,
                    Document::STATUS_CORRECTIONS_NEEDED
                ),
                'approved' => $this->countStatus(
                    $documents,
                    Document::STATUS_APPROVED
                ),
                'pending_notarization' => $this->countStatus(
                    $documents,
                    Document::STATUS_PENDING_NOTARIZATION
                ),
                'notarized' => $this->countStatus(
                    $documents,
                    Document::STATUS_NOTARIZED
                ),
            ],
            'recent_activity' => $this->recentActivity($documents),
            'notifications' => $this->statusNotices($documents),
            'status_distribution' => $this->statusDistribution($documents),
            'trend' => $this->statusTrend($documents),
        ];
    }

    public function superAdmin(): array
    {
        $stats = [
            'totalUsers' => $this->dashboards->totalUsers(),
            'activeUsers' => $this->dashboards->activeUsers(),
            'activeDepartments' =>
                $this->dashboards->activeDepartments(),
            'activeSessions' => 0,
            'failedLoginAttempts' => 0,
        ];

        return [
            'stats' => $stats,
            'trend' => [
                'daily' => $this->governanceTrend($stats, 'Today'),
                'weekly' => $this->governanceTrend($stats, 'Current'),
                'monthly' => $this->governanceTrend($stats, 'Current'),
            ],
            'recent_activity' => [],
            'system' => [
                'platform_status' => 'Operational',
                'database_status' => 'Connected',
                'storage_usage' => 'Not tracked',
                'security_alerts' => '0 warnings',
            ],
        ];
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

    private function recentActivity(Collection $documents): array
    {
        return $documents
            ->take(5)
            ->map(fn (Document $document): array => [
                'tracking_number' => $document->tracking_number,
                'entity_name' =>
                    $document->partner_institution ?? '-',
                'type' => $document->document_type ?? '-',
                'timestamp' => $document->updated_at
                    ? $document->updated_at->toISOString()
                    : $document->submitted_at?->toISOString(),
                'status' => $document->status,
                'department' => $document->department
                    ? [
                        'code' => $document->department->code,
                        'name' => $document->department->name,
                    ]
                    : null,
            ])
            ->values()
            ->all();
    }

    private function statusNotices(Collection $documents): array
    {
        return $documents
            ->whereIn('status', [
                Document::STATUS_SUBMITTED,
                Document::STATUS_CORRECTIONS_NEEDED,
                Document::STATUS_PENDING_NOTARIZATION,
            ])
            ->take(4)
            ->map(fn (Document $document): array => [
                'title' => $document->status,
                'detail' => "{$document->tracking_number} needs attention.",
                'tone' => match ($document->status) {
                    Document::STATUS_CORRECTIONS_NEEDED => 'warn',
                    Document::STATUS_PENDING_NOTARIZATION => 'info',
                    default => 'new',
                },
                'timestamp' => $document->updated_at
                    ? $document->updated_at->toISOString()
                    : $document->submitted_at?->toISOString(),
            ])
            ->values()
            ->all();
    }

    private function statusDistribution(Collection $documents): array
    {
        return $documents
            ->groupBy('status')
            ->map(fn (Collection $group, string $status): array => [
                'status' => $status,
                'count' => $group->count(),
            ])
            ->values()
            ->all();
    }

    private function statusTrend(Collection $documents): array
    {
        return $documents
            ->groupBy(fn (Document $document): string =>
                ($document->updated_at ?? $document->submitted_at)
                    ? ($document->updated_at ?? $document->submitted_at)
                        ->format('M d')
                    : 'Undated'
            )
            ->map(fn (Collection $group, string $period): array => [
                'period' => $period,
                'count' => $group->count(),
            ])
            ->values()
            ->all();
    }

    private function governanceTrend(
        array $stats,
        string $currentPeriod
    ): array {
        return [
            [
                'period' => 'Previous',
                ...$stats,
            ],
            [
                'period' => $currentPeriod,
                ...$stats,
            ],
        ];
    }
}
