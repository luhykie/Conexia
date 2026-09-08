<?php

namespace App\Repositories;

use App\Models\Department;
use App\Models\Document;
use App\Models\Profile;
use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

class DashboardRepository
{
    public function departmentDocuments(Profile $profile): Collection
    {
        return Document::query()
            ->select($this->dashboardColumns())
            ->with('department')
            ->withExists([
                'auditLogs as viewed' => fn ($query) => $query
                    ->where('action', 'document.viewed')
                    ->where('actor_id', $profile->id),
            ])
            ->where('department_id', $profile->department_id)
            ->orderByDesc('updated_at')
            ->get();
    }

    public function iroDocuments(bool $includeArchived = true): Collection
    {
        return Document::query()
            ->select($this->dashboardColumns())
            ->with('department')
            ->when(
                !$includeArchived,
                fn ($query) => $query->where(
                    'status',
                    '!=',
                    Document::STATUS_ARCHIVED
                )
            )
            ->orderByDesc('updated_at')
            ->get();
    }

    public function legalDocuments(Profile $profile): Collection
    {
        return Document::query()
            ->select($this->dashboardColumns())
            ->with('department')
            ->withExists([
                'auditLogs as viewed' => fn ($query) => $query
                    ->where('action', 'document.viewed')
                    ->where('actor_id', $profile->id),
            ])
            ->where('assigned_legal_counsel', $profile->id)
            ->orderByDesc('updated_at')
            ->get();
    }

    public function totalUsers(): int
    {
        return Profile::query()->count();
    }

    public function activeUsers(): int
    {
        return Profile::query()
            ->where('is_active', true)
            ->count();
    }

    public function activeUsersByDepartment(): array
    {
        return Profile::query()
            ->select('department_id', DB::raw('count(*) as total'))
            ->where('is_active', true)
            ->whereNotNull('department_id')
            ->groupBy('department_id')
            ->pluck('total', 'department_id')
            ->map(fn ($total): int => (int) $total)
            ->all();
    }

    public function activeDepartments(): int
    {
        return Department::query()->count();
    }

    public function activeSessions(int $windowMinutes = 15): int
    {
        if (!Schema::hasTable('sessions')) {
            return 0;
        }

        return DB::table('sessions')
            ->where(
                'last_activity',
                '>=',
                now()->subMinutes($windowMinutes)->timestamp
            )
            ->count();
    }

    public function activityCounts(string $period, int $buckets): array
    {
        $buckets = collect(range($buckets - 1, 0))
            ->map(fn (int $offset): array =>
                $this->activityBucket($period, $offset)
            );
        $firstBucket = $buckets->first();

        if (!Schema::hasTable('audit_logs')) {
            return $buckets
                ->map(fn (array $bucket): array => [
                    'period' => $bucket['label'],
                    'activity' => 0,
                    'activeUsers' => 0,
                ])
                ->values()
                ->all();
        }

        $counts = AuditLog::query()
            ->selectRaw($this->activityBucketExpression($period).' as bucket')
            ->selectRaw('count(*) as activity')
            ->selectRaw('count(distinct actor_id) as active_users')
            ->whereNotNull('created_at')
            ->where('created_at', '>=', $firstBucket['start'])
            ->groupBy('bucket')
            ->get()
            ->mapWithKeys(fn ($row): array => [
                $row->bucket => [
                    'activity' => (int) $row->activity,
                    'activeUsers' => (int) $row->active_users,
                ],
            ]);

        return $buckets
            ->map(fn (array $bucket): array => [
                'period' => $bucket['label'],
                'activity' => $counts[$bucket['key']]['activity'] ?? 0,
                'activeUsers' => $counts[$bucket['key']]['activeUsers'] ?? 0,
            ])
            ->values()
            ->all();
    }

    public function documentStorageBytes(): ?int
    {
        if (
            !Schema::hasTable('document_files') ||
            !Schema::hasColumn('document_files', 'size')
        ) {
            return null;
        }

        return (int) DB::table('document_files')->sum('size');
    }

    public function databaseStatus(): string
    {
        try {
            DB::select('select 1');
        } catch (Throwable) {
            return 'Unavailable';
        }

        return 'Connected';
    }

    private function dashboardColumns(): array
    {
        return [
            'id',
            'tracking_number',
            'title',
            'document_type',
            'partner_institution',
            'partnership_scope',
            'department_id',
            'assigned_legal_counsel',
            'status',
            'submitted_at',
            'updated_at',
        ];
    }

    private function activityBucket(string $period, int $offset): array
    {
        $now = now();

        if ($period === 'daily') {
            $start = $now->copy()->subDays($offset)->startOfDay();

            return [
                'key' => $start->format('Y-m-d'),
                'label' => $start->format('M j'),
                'start' => $start,
            ];
        }

        if ($period === 'weekly') {
            $start = $now->copy()
                ->subWeeks($offset)
                ->startOfWeek(1);

            return [
                'key' => $start->format('Y-m-d'),
                'label' => $start->format('M j'),
                'start' => $start,
            ];
        }

        $start = $now->copy()->subMonths($offset)->startOfMonth();

        return [
            'key' => $start->format('Y-m'),
            'label' => $start->format('M Y'),
            'start' => $start,
        ];
    }

    private function activityBucketExpression(string $period): string
    {
        $driver = DB::connection()->getDriverName();

        if ($driver === 'pgsql') {
            return match ($period) {
                'daily' => "to_char(created_at, 'YYYY-MM-DD')",
                'weekly' => "to_char(date_trunc('week', created_at), 'YYYY-MM-DD')",
                'monthly' => "to_char(created_at, 'YYYY-MM')",
            };
        }

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            return match ($period) {
                'daily' => "date_format(created_at, '%Y-%m-%d')",
                'weekly' => "date_format(date_sub(date(created_at), interval weekday(created_at) day), '%Y-%m-%d')",
                'monthly' => "date_format(created_at, '%Y-%m')",
            };
        }

        return match ($period) {
            'daily' => "strftime('%Y-%m-%d', created_at)",
            'weekly' => "date(created_at, '-' || ((cast(strftime('%w', created_at) as integer) + 6) % 7) || ' days')",
            'monthly' => "strftime('%Y-%m', created_at)",
        };
    }
}
