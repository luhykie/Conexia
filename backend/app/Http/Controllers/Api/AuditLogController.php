<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Support\Pagination;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AuditLogController extends Controller
{
    public function index(Request $request)
    {
        $options = Pagination::options(
            $request,
            ['created_at', 'action'],
            'created_at'
        );

        $logs = $this->query($request)
            ->orderBy($options['sort'], $options['direction'])
            ->paginate(
                $options['per_page'],
                ['*'],
                'page',
                $options['page']
            );

        return response()->json([
            'success' => true,
            'message' => 'Audit logs loaded successfully.',
            'data' => collect($logs->items())
                ->map(fn (AuditLog $log) => $this->row($log))
                ->values(),
            'meta' => Pagination::meta($logs),
        ]);
    }

    public function export(Request $request): StreamedResponse
    {
        $filename = 'CONEXIA-Audit-Logs-'.now()->format('Ymd').'.csv';
        $logs = $this->query($request)
            ->latest('created_at')
            ->limit(5000);

        return response()->streamDownload(function () use ($logs): void {
            $handle = fopen('php://output', 'w');

            fputcsv($handle, [
                'Timestamp',
                'User',
                'Role',
                'Activity',
                'Metadata',
            ]);

            $logs->chunk(500, function ($chunk) use ($handle): void {
                foreach ($chunk as $log) {
                    fputcsv($handle, [
                        optional($log->created_at)->toDateTimeString(),
                        $log->actor?->full_name ?? 'System',
                        $log->actor?->role ?? '-',
                        $log->action,
                        json_encode($log->metadata ?? []),
                    ]);
                }
            });

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv',
        ]);
    }

    private function query(Request $request)
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'action' => ['nullable', 'string', 'max:120'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
        ]);

        $operator = Pagination::searchOperator();

        return AuditLog::query()
            ->with('actor:id,full_name,email,role')
            ->when(!empty($validated['search']), function ($query) use ($validated, $operator): void {
                $search = trim($validated['search']);

                $query->where(function ($builder) use ($search, $operator): void {
                    $builder
                        ->where('action', $operator, "%{$search}%")
                        ->orWhereHas('actor', function ($actorQuery) use ($search, $operator): void {
                            $actorQuery
                                ->where('full_name', $operator, "%{$search}%")
                                ->orWhere('email', $operator, "%{$search}%");
                        });
                });
            })
            ->when(!empty($validated['action']), function ($query) use ($validated): void {
                $query->where('action', $validated['action']);
            })
            ->when(!empty($validated['date_from']), function ($query) use ($validated): void {
                $query->whereDate('created_at', '>=', $validated['date_from']);
            })
            ->when(!empty($validated['date_to']), function ($query) use ($validated): void {
                $query->whereDate('created_at', '<=', $validated['date_to']);
            });
    }

    private function row(AuditLog $log): array
    {
        return [
            'id' => $log->id,
            'created_at' => optional($log->created_at)->toISOString(),
            'user' => $log->actor?->full_name ?? 'System',
            'email' => $log->actor?->email,
            'role' => $log->actor?->role,
            'action' => $log->action,
            'metadata' => $log->metadata ?? [],
        ];
    }
}
