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

    public function iro(Profile $profile): array
    {
        $documents = $this->dashboards->iroDocuments()
            ->reject(fn (Document $document): bool => in_array(
                $document->status,
                [
                    Document::STATUS_PENDING_NOTARIZATION,
                    Document::STATUS_NOTARIZED,
                ],
                true
            ))
            ->values();
        $queueDocuments = $documents
            ->reject(fn (Document $document): bool =>
                $document->status === Document::STATUS_ARCHIVED
            )
            ->values();

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
                'pending_archival' => $this->countStatus(
                    $documents,
                    Document::STATUS_APPROVED
                ),
                'completed' => $this->countStatus(
                    $documents,
                    Document::STATUS_ARCHIVED
                ),
                'archived' => $this->countStatus(
                    $documents,
                    Document::STATUS_ARCHIVED
                ),
                'total_submissions' => $documents->count(),
            ],
            'recent_activity' => $this->recentActivity(
                $queueDocuments,
                false,
                $profile->role === Profile::ROLE_IRO_ADMIN
            ),
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
        $documents = $this->dashboards->iroDocuments();

        $stats = [
            'totalUsers' => $this->dashboards->totalUsers(),
            'activeUsers' => $this->dashboards->activeUsers(),
            'activeDepartments' =>
                $this->dashboards->activeDepartments(),
            'activeSessions' => $this->dashboards->activeSessions(),
            'failedLoginAttempts' => 0,
        ];

        return [
            'stats' => $stats,
            'trend' => $this->auditActivityTrend($stats),
            'offices' => $this->officeBreakdown($documents),
            'recent_activity' => [],
            'system' => [
                'platform_status' => 'Operational',
                'database_status' => $this->dashboards->databaseStatus(),
                'storage_usage' => $this->formatStorageUsage(
                    $this->dashboards->documentStorageBytes()
                ),
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

    private function recentActivity(
        Collection $documents,
        bool $reminderOnly = false,
        bool $includePartnershipScope = false
    ): array
    {
        return $documents
            ->take(5)
            ->map(function (Document $document) use (
                $reminderOnly,
                $includePartnershipScope
            ): array {
                $department = $document->department
                    ? [
                        'code' => $document->department->code,
                        'name' => $document->department->name,
                    ]
                    : null;

                $payload = [
                    'tracking_number' => $document->tracking_number,
                    'title' => $document->title,
                    'document_type' => $document->document_type,
                    'partnership_scope' => $document->partnership_scope,
                    'timestamp' => $document->updated_at
                        ? $document->updated_at->toISOString()
                        : $document->submitted_at?->toISOString(),
                    'status' => $document->status,
                    'department' => $department,
                ];

                if ($includePartnershipScope) {
                    $payload['id'] = $document->id;
                    $payload['partnership_scope'] =
                        $document->partnership_scope;
                }

                if ($reminderOnly) {
                    return [
                        ...$payload,
                        'entity_name' =>
                            $department['code'] ?? $department['name'] ?? 'PAIR/IRO',
                        'type' => $document->document_type ?? '-',
                    ];
                }

                return [
                    ...$payload,
                    'entity_name' =>
                        $document->partner_institution ?? '-',
                    'type' => $document->document_type ?? '-',
                ];
            })
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

    private function auditActivityTrend(array $stats): array
    {
        return [
            'daily' => $this->auditActivityPoints(
                $this->dashboards->activityCounts('daily', 7),
                $stats
            ),
            'weekly' => $this->auditActivityPoints(
                $this->dashboards->activityCounts('weekly', 8),
                $stats
            ),
            'monthly' => $this->auditActivityPoints(
                $this->dashboards->activityCounts('monthly', 6),
                $stats
            ),
        ];
    }

    private function auditActivityPoints(array $activity, array $stats): array
    {
        return collect($activity)
            ->map(fn (array $point): array => [
                'period' => $point['period'],
                'totalUsers' => $stats['totalUsers'],
                'activeUsers' => $point['activeUsers'],
                'activeDepartments' => $stats['activeDepartments'],
                'activeSessions' => $stats['activeSessions'],
                'activity' => $point['activity'],
            ])
            ->values()
            ->all();
    }

    private function officeBreakdown(Collection $documents): array
    {
        $activeUsersByDepartment =
            $this->dashboards->activeUsersByDepartment();

        return $documents
            ->groupBy(fn (Document $document): string =>
                $document->department_id ?? 'unassigned'
            )
            ->map(function (Collection $group, string $departmentId) use (
                $activeUsersByDepartment
            ): array {
                $department = $group->first()?->department;

                return [
                    'code' => $department?->code ?? 'N/A',
                    'name' => $department?->name ?? 'Unassigned',
                    'totalDocuments' => $group->count(),
                    'pending' => $this->countIn($group, [
                        Document::STATUS_SUBMITTED,
                        Document::STATUS_CORRECTIONS_NEEDED,
                        Document::STATUS_PENDING_NOTARIZATION,
                    ]),
                    'active' => $this->countIn($group, [
                        Document::STATUS_SUBMITTED,
                        Document::STATUS_LOGGED,
                        Document::STATUS_UNDER_LEGAL_REVIEW,
                        Document::STATUS_CORRECTIONS_NEEDED,
                        Document::STATUS_APPROVED,
                        Document::STATUS_PENDING_NOTARIZATION,
                    ]),
                    'activeUsers' =>
                        $activeUsersByDepartment[$departmentId] ?? 0,
                ];
            })
            ->sortBy('code')
            ->values()
            ->all();
    }

    private function formatStorageUsage(?int $bytes): string
    {
        if ($bytes === null) {
            return 'Not tracked';
        }

        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $value = max($bytes, 0);
        $unitIndex = 0;

        while ($value >= 1024 && $unitIndex < count($units) - 1) {
            $value /= 1024;
            $unitIndex++;
        }

        $formatted = $unitIndex === 0
            ? (string) $value
            : number_format($value, 1);

        return "{$formatted} {$units[$unitIndex]}";
    }
}
