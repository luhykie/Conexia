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
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

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
                    'pendingValidation' => $documents->where('status', 'Review Form Submitted')->count(),
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
                'expiringDocuments' => $documents
                    ->filter(fn (Document $document): bool => $document->expiry_date !== null)
                    ->sortBy('expiry_date')
                    ->values(),
            ],
        ]);
    }

    public function reassign(
        Request $request,
        Document $document
    ): JsonResponse {
        $validated = $request->validate([
            'iro_staff_id' => [
                'required',
                'uuid',
                Rule::exists('profiles', 'id')
                    ->where('role', 'iro_staff')
                    ->where('is_active', true),
            ],
            'reason' => [
                'required',
                'string',
                'max:2000',
            ],
        ]);

        if (! $document->assigned_iro_staff) {
            return response()->json([
                'message' => 'Only assigned submissions can be reassigned.',
            ], 422);
        }

        if (
            in_array($document->status, ['Approved', 'Archived'], true)
        ) {
            return response()->json([
                'message' => 'Completed submissions cannot be reassigned.',
            ], 422);
        }

        if ($document->assigned_iro_staff === $validated['iro_staff_id']) {
            return response()->json([
                'message' => 'Select a different IRO Staff member.',
            ], 422);
        }

        $updatedDocument = DB::transaction(function () use (
            $request,
            $document,
            $validated
        ): Document {
            $lockedDocument = Document::query()
                ->whereKey($document->id)
                ->lockForUpdate()
                ->firstOrFail();
            $previousStaff = Profile::query()
                ->findOrFail($lockedDocument->assigned_iro_staff);
            $newStaff = Profile::query()
                ->whereKey($validated['iro_staff_id'])
                ->where('role', 'iro_staff')
                ->where('is_active', true)
                ->firstOrFail();

            $lockedDocument->update([
                'assigned_iro_staff' => $newStaff->id,
                'updated_at' => now(),
            ]);

            WorkflowEvent::create([
                'document_id' => $lockedDocument->id,
                'actor_id' =>
                    $request->attributes->get('auth_profile')->id,
                'actor_role' => 'iro_admin',
                'event_type' => 'submission_reassigned',
                'from_status' => $lockedDocument->status,
                'to_status' => $lockedDocument->status,
                'notes' => sprintf(
                    'IRO Staff assignment changed from %s to %s. Reason: %s',
                    $previousStaff->full_name ?: $previousStaff->email,
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
            'message' => 'Submission reassigned successfully.',
            'data' => $updatedDocument->fresh(
                'assignedIroStaffProfile:id,full_name,email,role'
            ),
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
