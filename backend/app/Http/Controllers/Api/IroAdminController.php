<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Models\Department;
use App\Models\Profile;
use App\Models\ReviewForm;
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
            ->leftJoin('departments as overview_department', 'overview_department.id', '=', 'documents.department_id')
            ->leftJoin('profiles as overview_staff', 'overview_staff.id', '=', 'documents.assigned_iro_staff')
            ->leftJoin('review_forms as overview_review', 'overview_review.document_id', '=', 'documents.id')
            ->select('documents.*')
            ->addSelect([
                'overview_department.name as overview_department_name',
                'overview_staff.full_name as overview_staff_name',
                'overview_staff.email as overview_staff_email',
                'overview_staff.role as overview_staff_role',
                'overview_review.id as overview_review_id',
                'overview_review.review_form_status as overview_review_status',
                'overview_review.validated_at as overview_review_validated_at',
            ])
            ->orderByDesc('documents.updated_at')
            ->limit(200)
            ->get()
            ->each(function (Document $document): void {
                $document->setRelation('department', $document->department_id
                    ? (new Department())->forceFill(['id' => $document->department_id, 'name' => $document->overview_department_name])
                    : null);
                $document->setRelation('assignedIroStaffProfile', $document->assigned_iro_staff
                    ? (new Profile())->forceFill([
                        'id' => $document->assigned_iro_staff,
                        'full_name' => $document->overview_staff_name,
                        'email' => $document->overview_staff_email,
                        'role' => $document->overview_staff_role,
                    ])
                    : null);
                $document->setRelation('reviewForm', $document->overview_review_id
                    ? (new ReviewForm())->forceFill([
                        'id' => $document->overview_review_id,
                        'document_id' => $document->id,
                        'review_form_status' => $document->overview_review_status,
                        'validated_at' => $document->overview_review_validated_at,
                    ])
                    : null);
                $document->makeHidden([
                    'overview_department_name', 'overview_staff_name', 'overview_staff_email',
                    'overview_staff_role', 'overview_review_id', 'overview_review_status',
                    'overview_review_validated_at',
                ]);
            });
        $events = WorkflowEvent::query()
            ->leftJoin('documents as activity_document', 'activity_document.id', '=', 'workflow_events.document_id')
            ->select('workflow_events.*')
            ->addSelect([
                'activity_document.tracking_number as activity_tracking_number',
                'activity_document.partner_institution as activity_partner_institution',
                'activity_document.document_type as activity_document_type',
            ])
            ->orderByDesc('workflow_events.created_at')
            ->limit(100)
            ->get()
            ->each(function (WorkflowEvent $event): void {
                $event->setRelation('document', (new Document())->forceFill([
                    'id' => $event->document_id,
                    'tracking_number' => $event->activity_tracking_number,
                    'partner_institution' => $event->activity_partner_institution,
                    'document_type' => $event->activity_document_type,
                ]));
                $event->makeHidden([
                    'activity_tracking_number', 'activity_partner_institution', 'activity_document_type',
                ]);
            });

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
        ): Document|JsonResponse {
            $lockedDocument = Document::query()
                ->whereKey($document->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($lockedDocument->assigned_iro_staff === $systemIroStaff->id) {
                return response()->json([
                    'message' => 'This submission is already assigned to the active IRO Staff account.',
                ], 422);
            }

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

        if ($updatedDocument instanceof JsonResponse) {
            return $updatedDocument;
        }

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

    public function assignDistribution(Request $request, Document $document): JsonResponse
    {
        $validated = $request->validate([
            'instructions' => ['nullable', 'string', 'max:5000'],
        ]);

        if ($document->status !== 'Approved') {
            return response()->json([
                'message' => 'Only documents approved by Legal Counsel can be assigned for distribution.',
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
            $document->update([
                'assigned_iro_staff' => $iroStaff->id,
                'admin_distribution_instructions' => $validated['instructions'] ?? null,
                'status' => 'Assigned for Distribution',
                'updated_at' => now(),
            ]);

            WorkflowEvent::create([
                'document_id' => $document->id,
                'actor_id' => $request->attributes->get('auth_profile')->id,
                'actor_role' => 'iro_admin',
                'event_type' => 'distribution_assigned_to_iro_staff',
                'from_status' => 'Approved',
                'to_status' => 'Assigned for Distribution',
                'notes' => $validated['instructions'] ?: 'Approved-document distribution assigned to IRO Staff.',
                'created_at' => now(),
            ]);

            $this->notifications->distributionAssignedToStaff($document, $iroStaff);
        });

        return response()->json([
            'message' => 'Approved document assigned to IRO Staff for distribution.',
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

    public function unarchive(Request $request, Document $document): JsonResponse
    {
        if ($document->status !== 'Archived' || ! $document->archived_at) {
            return response()->json([
                'message' => 'Only archived records can be restored.',
            ], 422);
        }

        $profile = $request->attributes->get('auth_profile');
        DB::transaction(function () use ($document, $profile): void {
            $document->update([
                'status' => 'Distribution Complete',
                'archived_at' => null,
                'archived_by' => null,
                'updated_at' => now(),
            ]);
            WorkflowEvent::create([
                'document_id' => $document->id,
                'actor_id' => $profile->id,
                'actor_role' => $profile->role,
                'event_type' => 'document_unarchived',
                'from_status' => 'Archived',
                'to_status' => 'Distribution Complete',
                'notes' => 'Archived record was restored by IRO Admin.',
                'created_at' => now(),
            ]);
        });

        return response()->json([
            'message' => 'Record restored from the archive.',
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
