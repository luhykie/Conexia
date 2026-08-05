<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Models\Profile;
use App\Models\WorkflowEvent;
use App\Services\NotificationService;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class IroAdminController extends Controller
{
    public function __construct(
        private readonly NotificationService $notifications
    ) {
    }

    public function overview(Request $request): JsonResponse
    {
        $documents = Document::query()
            ->with([
                'department:id,name',
                'assignedIroStaffProfile:id,full_name,email,role',
                'reviewForm:id,document_id,review_form_status,validated_at',
            ])
            ->orderByDesc('updated_at')
            ->get();
        $events = WorkflowEvent::query()
            ->with('document:id,tracking_number,partner_institution,document_type')
            ->orderBy('created_at')
            ->get();

        return response()->json([
            'data' => [
                'stats' => [
                    'totalSubmissions' => $documents->count(),
                    'pendingValidation' => $documents->whereIn('status', ['Logged', 'Review Form Submitted'])->count(),
                    'averageTurnaroundHours' => $this->averageTurnaroundHours($documents),
                    'notarizedThisMonth' => $documents->filter(
                        fn (Document $document): bool =>
                            $document->notarization_date
                            && now()->isSameMonth($document->notarization_date)
                    )->count(),
                ],
                'activities' => $events->sortByDesc('created_at')->take(10)->values(),
                'assignedSubmissions' => $documents->filter(
                    fn (Document $document): bool =>
                        $document->assigned_iro_staff !== null
                        && ! in_array(
                            $document->status,
                            [
                                'Approved',
                                'Ready for Distribution',
                                'Distribution Complete',
                                'Archived',
                            ],
                            true
                        )
                )->values(),
                'activeIroStaff' => Profile::query()
                    ->where('role', 'iro_staff')
                    ->where('is_active', true)
                    ->orderBy('full_name')
                    ->get(['id', 'full_name', 'email']),
                'reports' => $this->reportData($documents, $events),
                'archivedDocuments' => $documents
                    ->filter(fn (Document $document): bool => $document->archived_at !== null)
                    ->values(),
                'readyToArchive' => $documents
                    ->where('status', 'Distribution Complete')
                    ->values(),
                'expiringDocuments' => $documents
                    ->filter(fn (Document $document): bool => $document->expiry_date !== null)
                    ->sortBy('expiry_date')
                    ->values(),
            ],
        ]);
    }

    public function reports(): JsonResponse
    {
        $report = Cache::remember('iro-admin:reports:v1', 60, function (): array {
            $documents = Document::query()
                ->select([
                    'id',
                    'department_id',
                    'status',
                    'submitted_at',
                    'notarization_date',
                ])
                ->with('department:id,name')
                ->get();
            $events = WorkflowEvent::query()
                ->select(['document_id', 'event_type', 'created_at'])
                ->whereIn('event_type', [
                    'document_logged',
                    'review_form_submitted',
                    'review_form_validated',
                    'legal_approved',
                    'corrections_requested',
                ])
                ->orderBy('created_at')
                ->get();

            return $this->reportData($documents, $events);
        });

        return response()->json([
            'data' => $report,
        ]);
    }

    public function reassign(
        Request $request,
        Document $document
    ): JsonResponse {
        $validated = $request->validate([
            'reason' => [
                'required',
                'string',
                'max:2000',
            ],
        ]);

        if (
            in_array($document->status, ['Approved', 'Archived'], true)
        ) {
            return response()->json([
                'message' => 'Completed submissions cannot be reassigned.',
            ], 422);
        }

        $activeIroStaff = Profile::query()
            ->where('role', 'iro_staff')
            ->where('is_active', true)
            ->get();

        if ($activeIroStaff->count() !== 1) {
            return response()->json([
                'message' => 'The system requires exactly one active IRO Staff account.',
            ], 422);
        }

        $systemIroStaff = $activeIroStaff->first();

        $updatedDocument = DB::transaction(function () use (
            $request,
            $document,
            $validated,
            $systemIroStaff
        ): Document {
            $lockedDocument = Document::query()
                ->whereKey($document->id)
                ->lockForUpdate()
                ->firstOrFail();
            $previousStaff = $lockedDocument->assigned_iro_staff
                ? Profile::query()->find($lockedDocument->assigned_iro_staff)
                : null;
            $newStaff = $systemIroStaff;
            $previousStatus = $lockedDocument->status;
            $isLegalRevision = filled($lockedDocument->legal_notes)
                && $lockedDocument->reviewForm()
                    ->where('review_form_status', 'validated')
                    ->exists();
            $nextStatus = $isLegalRevision
                ? 'Assigned for Revision Handling'
                : 'Review Form Sent Back';

            $lockedDocument->update([
                'assigned_iro_staff' => $newStaff->id,
                'status' => $nextStatus,
                'updated_at' => now(),
            ]);

            WorkflowEvent::create([
                'document_id' => $lockedDocument->id,
                'actor_id' =>
                    $request->attributes->get('auth_profile')->id,
                'actor_role' => 'iro_admin',
                'event_type' => 'submission_reassigned',
                'from_status' => $previousStatus,
                'to_status' => $nextStatus,
                'notes' => sprintf(
                    'Submission returned and automatically assigned to %s. Reason: %s',
                    $newStaff->full_name ?: $newStaff->email,
                    $validated['reason']
                ),
                'created_at' => now(),
            ]);

            $this->notifications->submissionReassigned(
                $lockedDocument,
                $previousStaff,
                $newStaff,
                $validated['reason']
            );

            return $lockedDocument;
        });

        return response()->json([
            'message' => 'Submission returned to IRO Staff successfully.',
            'data' => $updatedDocument->fresh(
                'assignedIroStaffProfile:id,full_name,email,role'
            ),
        ]);
    }

    public function assignRevision(Request $request, Document $document): JsonResponse
    {
        $validated = $request->validate([
            'instructions' => ['nullable', 'string', 'max:5000'],
        ]);

        if ($document->status !== 'Corrections Needed') {
            return response()->json([
                'message' => 'Only documents returned by Legal Counsel can be assigned for revision handling.',
            ], 422);
        }

        $staff = Profile::query()
            ->where('role', 'iro_staff')
            ->where('is_active', true)
            ->get();

        if ($staff->count() !== 1) {
            return response()->json([
                'message' => 'The system requires exactly one active IRO Staff account.',
            ], 422);
        }

        $iroStaff = $staff->first();

        DB::transaction(function () use ($request, $document, $validated, $iroStaff): void {
            $previousStatus = $document->status;
            $document->update([
                'assigned_iro_staff' => $iroStaff->id,
                'admin_revision_instructions' => $validated['instructions'] ?? null,
                'staff_forwarding_note' => null,
                'status' => 'Assigned for Revision Handling',
                'updated_at' => now(),
            ]);

            WorkflowEvent::create([
                'document_id' => $document->id,
                'actor_id' => $request->attributes->get('auth_profile')->id,
                'actor_role' => 'iro_admin',
                'event_type' => 'revision_assigned_to_iro_staff',
                'from_status' => $previousStatus,
                'to_status' => 'Assigned for Revision Handling',
                'notes' => $validated['instructions'] ?: 'Revision handling assigned to IRO Staff.',
                'created_at' => now(),
            ]);

            $this->notifications->revisionAssignedToStaff($document, $iroStaff);
        });

        return response()->json([
            'message' => 'Revision handling assigned to IRO Staff.',
            'data' => $document->fresh('assignedIroStaffProfile:id,full_name,email,role'),
        ]);
    }

    public function archive(Request $request, Document $document): JsonResponse
    {
        if ($document->status !== 'Distribution Complete') {
            return response()->json([
                'message' => 'Only records with completed distribution can be archived.',
            ], 422);
        }

        $profile = $request->attributes->get('auth_profile');
        DB::transaction(function () use ($document, $profile): void {
            $document->update([
                'status' => 'Archived',
                'archived_at' => now(),
                'archived_by' => $profile->id,
                'updated_at' => now(),
            ]);
            WorkflowEvent::create([
                'document_id' => $document->id,
                'actor_id' => $profile->id,
                'actor_role' => $profile->role,
                'event_type' => 'document_archived',
                'from_status' => 'Distribution Complete',
                'to_status' => 'Archived',
                'notes' => 'Distribution was completed before archival.',
                'created_at' => now(),
            ]);
        });

        return response()->json([
            'message' => 'Record archived successfully.',
            'data' => $document->fresh(),
        ]);
    }

    private function reportData(Collection $documents, Collection $events): array
    {
        $eventsByDocument = $events->groupBy('document_id');
        $durations = [
            'submissionToLogging' => [],
            'loggingToValidation' => [],
            'validationToLegalDecision' => [],
            'approvalToNotarization' => [],
        ];

        foreach ($documents as $document) {
            $documentEvents = $eventsByDocument->get($document->id, collect());
            $logged = $this->eventTime($documentEvents, ['document_logged', 'review_form_submitted']);
            $validated = $this->eventTime($documentEvents, ['review_form_validated']);
            $decision = $this->eventTime($documentEvents, ['legal_approved', 'corrections_requested']);
            $approved = $this->eventTime($documentEvents, ['legal_approved']);

            $this->addDuration($durations['submissionToLogging'], $document->submitted_at, $logged);
            $this->addDuration($durations['loggingToValidation'], $logged, $validated);
            $this->addDuration($durations['validationToLegalDecision'], $validated, $decision);
            $this->addDuration($durations['approvalToNotarization'], $approved, $document->notarization_date);
        }

        return [
            'reviewed' => $events->where('event_type', 'review_form_validated')->count(),
            'returned' => $events->where('event_type', 'corrections_requested')->count(),
            'approved' => $events->where('event_type', 'legal_approved')->count(),
            'notarized' => $documents->filter(
                fn (Document $document): bool => $document->notarization_date !== null
            )->count(),
            'averageStageHours' => collect($durations)->map(
                fn (array $values): ?float => count($values)
                    ? round(array_sum($values) / count($values), 1)
                    : null
            ),
            'departments' => $documents
                ->groupBy(fn (Document $document): string =>
                    $document->department?->name ?? 'Unknown department'
                )
                ->map(function (Collection $items, string $department): array {
                    return [
                        'department' => $department,
                        'total' => $items->count(),
                        'approved' => $items->where('status', 'Approved')->count(),
                        'returned' => $items->where('status', 'Corrections Needed')->count(),
                    ];
                })
                ->values(),
        ];
    }

    private function averageTurnaroundHours(Collection $documents): ?float
    {
        $values = $documents
            ->filter(fn (Document $document): bool =>
                $document->submitted_at
                && $document->updated_at
                && in_array($document->status, ['Approved', 'Archived'], true)
            )
            ->map(fn (Document $document): float =>
                $document->submitted_at->diffInMinutes($document->updated_at) / 60
            );

        return $values->isEmpty() ? null : round($values->average(), 1);
    }

    private function eventTime(Collection $events, array $types): ?CarbonInterface
    {
        return $events->first(
            fn (WorkflowEvent $event): bool => in_array($event->event_type, $types, true)
        )?->created_at;
    }

    private function addDuration(array &$durations, mixed $from, mixed $to): void
    {
        if (! $from || ! $to) {
            return;
        }

        $fromDate = $from instanceof CarbonInterface ? $from : Carbon::parse($from);
        $toDate = $to instanceof CarbonInterface ? $to : Carbon::parse($to);
        $durations[] = $fromDate->diffInMinutes($toDate) / 60;
    }
}
