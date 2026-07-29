<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Models\DocumentFile;
use App\Models\WorkflowEvent;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DocumentController extends Controller
{
    public function __construct(
        private readonly NotificationService $notifications
    ) {
    }
    /**
     * GET /api/documents
     * Return all documents.
     */
    public function index(Request $request): JsonResponse
    {
        $profile = $this->profile($request);
        $query = Document::query()
            ->with($this->documentRelationships());

        if ($profile->role === 'iro_staff') {
            $query->where(function ($query) use ($profile): void {
                $query->where('status', 'Submitted')
                    ->orWhere('assigned_iro_staff', $profile->id);
            });
        }

        $documents = $query
            ->orderByDesc('submitted_at')
            ->get();

        return response()->json([
            'data' => $documents,
        ]);
    }

    public function iroStaffDashboard(Request $request): JsonResponse
    {
        $profile = $this->profile($request);

        $queue = Document::query()
            ->with($this->documentRelationships())
            ->where('status', 'Submitted')
            ->orderBy('submitted_at')
            ->limit(5)
            ->get();

        $activities = WorkflowEvent::query()
            ->with('document:id,tracking_number,partner_institution')
            ->whereHas('document', function ($query) use ($profile): void {
                $query->where('status', 'Submitted')
                    ->orWhere('assigned_iro_staff', $profile->id);
            })
            ->orderByDesc('created_at')
            ->limit(6)
            ->get();

        $today = now()->startOfDay();

        return response()->json([
            'data' => [
                'stats' => [
                    'incoming' => Document::query()
                        ->where('status', 'Submitted')
                        ->count(),
                    'loggedToday' => WorkflowEvent::query()
                        ->where('event_type', 'document_logged')
                        ->where('created_at', '>=', $today)
                        ->when(
                            $profile->role === 'iro_staff',
                            fn ($query) => $query->where(
                                'actor_id',
                                $profile->id
                            )
                        )
                        ->count(),
                    'awaitingCheck' => Document::query()
                        ->where('status', 'Logged')
                        ->when(
                            $profile->role === 'iro_staff',
                            fn ($query) => $query->where(
                                'assigned_iro_staff',
                                $profile->id
                            )
                        )
                        ->count(),
                    'routedToLegal' => Document::query()
                        ->where('status', 'Under Legal Review')
                        ->when(
                            $profile->role === 'iro_staff',
                            fn ($query) => $query->where(
                                'assigned_iro_staff',
                                $profile->id
                            )
                        )
                        ->count(),
                ],
                'queue' => $queue,
                'activities' => $activities,
            ],
        ]);
    }

    /**
     * POST /api/documents
     * Department Staff submits a document.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'tracking_number' => [
                'required',
                'string',
                'max:255',
                'unique:documents,tracking_number',
            ],
            'title' => [
                'required',
                'string',
                'max:255',
            ],
            'document_type' => [
                'required',
                'string',
                Rule::in([
                    'MOA',
                    'MOU',
                    'MOF',
                ]),
            ],
            'partner_institution' => [
                'required',
                'string',
                'max:255',
            ],
            'partner_email' => [
                'nullable',
                'email',
                'max:255',
            ],
            'description' => [
                'nullable',
                'string',
            ],
            'file' => [
                'required',
                'file',
                'max:25600',
                'mimes:pdf,doc,docx,odt',
            ],
        ]);

        $file = $validated['file'];
        unset($validated['file']);
        $path = null;

        try {
            $document = DB::transaction(function () use (
                $request,
                $validated,
                $file,
                &$path
            ) {
                $document = Document::create([
                    ...$validated,
                    'department_id' => $this->requireDepartment($request),
                    'submitted_by' => $this->profile($request)->id,
                    'status' => 'Submitted',
                    'submitted_at' => now(),
                    'updated_at' => now(),
                ]);

                $path = $file->store("documents/{$document->id}", 'local');

                DocumentFile::create([
                    'document_id' => $document->id,
                    'uploaded_by' => $this->profile($request)->id,
                    'file_category' => 'original_draft',
                    'original_filename' => $file->getClientOriginalName(),
                    'stored_filename' => basename($path),
                    'storage_disk' => 'local',
                    'storage_path' => $path,
                    'mime_type' => $file->getMimeType(),
                    'size' => $file->getSize(),
                    'version' => 1,
                ]);

                $this->recordWorkflowEvent(
                    $request,
                    $document,
                    'document_submitted',
                    null,
                    'Submitted',
                    "Original draft uploaded: {$file->getClientOriginalName()}"
                );
                $this->notifications->documentSubmitted($document);

                return $document;
            });
        } catch (\Throwable $error) {
            if ($path) {
                Storage::disk('local')->delete($path);
            }

            throw $error;
        }

        return response()->json([
            'message' => 'Document submitted successfully.',
            'data' => $document->load('files'),
        ], 201);
    }

    /**
     * GET /api/iro-staff/incoming
     * Return documents waiting for IRO Staff.
     */
    public function incoming(): JsonResponse
    {
        $documents = Document::query()
            ->with($this->documentRelationships())
            ->where('status', 'Submitted')
            ->orderByDesc('submitted_at')
            ->get();

        return response()->json([
            'data' => $documents,
        ]);
    }

    /**
     * GET /api/documents/{document}
     * Return one document.
     */
    public function show(
        Request $request,
        Document $document
    ): JsonResponse
    {
        $this->ensureCanView($request, $document);
        $document->load($this->documentRelationships());

        return response()->json([
            'data' => $document,
        ]);
    }

    /**
     * Stream one document attachment after checking record-level access.
     */
    public function viewFile(
        Request $request,
        Document $document,
        DocumentFile $documentFile
    ): StreamedResponse {
        $this->ensureCanView($request, $document);

        if ($documentFile->document_id !== $document->id) {
            abort(404);
        }

        $disk = Storage::disk($documentFile->storage_disk);

        if (! $disk->exists($documentFile->storage_path)) {
            abort(404, 'The stored document file could not be found.');
        }

        return $disk->response(
            $documentFile->storage_path,
            $documentFile->original_filename,
            [
                'Content-Type' => $documentFile->mime_type,
                'X-Content-Type-Options' => 'nosniff',
                'Cache-Control' => 'private, no-store',
            ]
        );
    }

    /**
     * PATCH /api/documents/{document}/log
     * IRO Staff submits a document to IRO Admin.
     */
    public function log(Request $request, Document $document): JsonResponse
    {
        if ($document->status !== 'Submitted') {
            return response()->json([
                'message' =>
                    'Only submitted documents can be logged.',
            ], 422);
        }

        DB::transaction(function () use ($request, $document): void {
            $previousStatus = $document->status;
            $revisionEvent = $document->workflowEvents()
                ->where('event_type', 'revision_resubmitted')
                ->latest('created_at')
                ->first();
            $lastCheck = $document->workflowEvents()
                ->where('event_type', 'revision_checked')
                ->latest('created_at')
                ->first();
            $isRevision = $revisionEvent
                && (! $lastCheck || $revisionEvent->created_at->gt($lastCheck->created_at));

            $document->update([
                'assigned_iro_staff' => $this->profile($request)->id,
                'status' => 'Logged',
                'updated_at' => now(),
            ]);

            if ($isRevision) {
                $version = DocumentFile::query()
                    ->where('document_id', $document->id)
                    ->max('version') ?? 2;
                $this->recordWorkflowEvent(
                    $request,
                    $document,
                    'revision_checked',
                    $previousStatus,
                    'Logged',
                    "Revision version {$version}; Review Form status: ready for validation"
                );
                $this->notifications->revisionChecked(
                    $document,
                    $this->profile($request),
                    (int) $version
                );
            } else {
                $this->recordWorkflowEvent(
                    $request,
                    $document,
                    'document_logged',
                    $previousStatus,
                    'Logged'
                );
                $this->notifications->documentLogged(
                    $document,
                    $this->profile($request)
                );
            }
        });

        return response()->json([
            'message' =>
                'Document submitted to IRO Admin.',
            'data' => $document->fresh(),
        ]);
    }

    /**
     * GET /api/iro-admin/manage-submissions
     * Return documents waiting for IRO Admin validation.
     */
    public function logged(): JsonResponse
    {
        $documents = Document::query()
            ->with($this->documentRelationships())
            ->whereIn('status', [
                'Review Form Submitted',
                'Admin Validated',
            ])
            ->orderByDesc('updated_at')
            ->get();

        return response()->json([
            'data' => $documents,
        ]);
    }

    /**
     * Department Staff resubmits a document returned by Legal Counsel.
     */
    public function resubmitRevision(
        Request $request,
        Document $document
    ): JsonResponse {
        $validated = $request->validate([
            'file' => [
                'required',
                'file',
                'max:25600',
                'mimes:pdf,doc,docx,odt',
            ],
        ]);
        $profile = $this->profile($request);

        if (
            $document->submitted_by !== $profile->id
            && $document->department_id !== $profile->department_id
        ) {
            abort(404);
        }

        if ($document->status !== 'Corrections Needed') {
            return response()->json([
                'message' => 'Only documents requiring corrections can be resubmitted.',
            ], 422);
        }

        $version = (int) (DocumentFile::query()
            ->where('document_id', $document->id)
            ->max('version') ?? 1) + 1;
        $file = $validated['file'];
        $path = $file->store("documents/{$document->id}", 'local');

        try {
            DB::transaction(function () use ($request, $document, $version, $file, $path): void {
                $previousStatus = $document->status;
                DocumentFile::create([
                    'document_id' => $document->id,
                    'uploaded_by' => $this->profile($request)->id,
                    'file_category' => 'reviewed_version',
                    'original_filename' => $file->getClientOriginalName(),
                    'stored_filename' => basename($path),
                    'storage_disk' => 'local',
                    'storage_path' => $path,
                    'mime_type' => $file->getMimeType(),
                    'size' => $file->getSize(),
                    'version' => $version,
                ]);
                $document->update([
                    'status' => 'Submitted',
                    'updated_at' => now(),
                ]);

                $this->recordWorkflowEvent(
                    $request,
                    $document,
                    'revision_resubmitted',
                    $previousStatus,
                    'Submitted',
                    "Revision version {$version}"
                );
                $this->notifications->revisionResubmitted($document, $version);
            });
        } catch (\Throwable $error) {
            Storage::disk('local')->delete($path);
            throw $error;
        }

        return response()->json([
            'message' => 'Revised document resubmitted.',
            'data' => $document->fresh(),
            'version' => $version,
        ]);
    }

    /**
     * IRO Staff completes the revised document completeness check.
     */
    public function checkRevision(
        Request $request,
        Document $document
    ): JsonResponse {
        if ($document->status !== 'Submitted') {
            return response()->json([
                'message' => 'Only resubmitted revisions can be checked.',
            ], 422);
        }

        $revisionEvent = $document->workflowEvents()
            ->where('event_type', 'revision_resubmitted')
            ->latest('created_at')
            ->first();

        if (! $revisionEvent) {
            return response()->json([
                'message' => 'This document is not a resubmitted revision.',
            ], 422);
        }

        $version = $this->notifications->revisionNumber($document) - 1;

        DB::transaction(function () use ($request, $document, $version): void {
            $previousStatus = $document->status;
            $staff = $this->profile($request);
            $document->update([
                'assigned_iro_staff' => $staff->id,
                'status' => 'Logged',
                'updated_at' => now(),
            ]);

            $this->recordWorkflowEvent(
                $request,
                $document,
                'revision_checked',
                $previousStatus,
                'Logged',
                "Revision version {$version}; Review Form status: ready for validation"
            );
            $this->notifications->revisionChecked($document, $staff, $version);
        });

        return response()->json([
            'message' => 'Revision completeness check completed.',
            'data' => $document->fresh(),
            'version' => $version,
        ]);
    }

    /**
     * PATCH /api/documents/{document}/route-to-legal
     * IRO Admin routes a logged document to Legal Counsel.
     */
    public function routeToLegal(
        Request $request,
        Document $document
    ): JsonResponse {
        $validated = $request->validate([
            'legal_counsel_id' => [
                'required',
                'uuid',
                Rule::exists('profiles', 'id')
                    ->where('role', 'legal_counsel')
                    ->where('is_active', true),
            ],
        ]);

        $reviewForm = $document->reviewForm;

        if (
            $document->status !== 'Admin Validated'
            || ! $reviewForm
            || $reviewForm->review_form_status !== 'validated'
            || ! $reviewForm->validated_by
            || ! $reviewForm->validated_at
        ) {
            return response()->json([
                'message' =>
                    'The Review Form must be validated by IRO Admin before routing.',
            ], 422);
        }

        DB::transaction(function () use (
            $request,
            $document,
            $validated
        ): void {
            $previousStatus = $document->status;

            $document->update([
                'assigned_legal_counsel' =>
                    $validated['legal_counsel_id'],
                'status' => 'Under Legal Review',
                'updated_at' => now(),
            ]);

            $this->recordWorkflowEvent(
                $request,
                $document,
                'routed_to_legal',
                $previousStatus,
                'Under Legal Review'
            );

            $revision = $document->workflowEvents()
                ->where('event_type', 'revision_checked')
                ->exists();
            $version = $revision
                ? $this->notifications->revisionNumber($document) - 1
                : 1;
            $this->notifications->routedToLegal($document, $version, $revision);
        });

        return response()->json([
            'message' =>
                'Document routed to Legal Counsel.',
            'data' => $document->fresh(),
        ]);
    }

    /**
     * GET /api/legal-counsel/review-queue
     * Return documents assigned to one Legal Counsel.
     */
    public function legalReviewQueue(
        Request $request
    ): JsonResponse {
        $legalCounselId = $this->profile($request)->id;

        $documents = Document::query()
            ->with($this->documentRelationships())
            ->where(
                'status',
                'Under Legal Review'
            )
            ->where(
                'assigned_legal_counsel',
                $legalCounselId
            )
            ->whereHas('reviewForm', function ($query): void {
                $query->where('review_form_status', 'validated')
                    ->whereNotNull('validated_by')
                    ->whereNotNull('validated_at');
            })
            ->orderByDesc('updated_at')
            ->get();

        return response()->json([
            'data' => $documents,
        ]);
    }

    /**
     * PATCH /api/documents/{document}/approve
     * Legal Counsel approves the document.
     */
    public function approve(
        Request $request,
        Document $document
    ): JsonResponse {
        $this->ensureAssignedLegalCounsel($request, $document);
        $this->ensureValidatedReviewForm($document);

        if ($document->status !== 'Under Legal Review') {
            return response()->json([
                'message' =>
                    'Only documents under legal review can be approved.',
            ], 422);
        }

        DB::transaction(function () use ($request, $document): void {
            $previousStatus = $document->status;

            $document->update([
                'status' => 'Approved',
                'updated_at' => now(),
            ]);

            $this->recordWorkflowEvent(
                $request,
                $document,
                'legal_approved',
                $previousStatus,
                'Approved'
            );
        });

        return response()->json([
            'message' => 'Document approved.',
            'data' => $document->fresh(),
        ]);
    }

    /**
     * PATCH /api/documents/{document}/request-corrections
     * Legal Counsel sends the document back for corrections.
     */
    public function requestCorrections(
        Request $request,
        Document $document
    ): JsonResponse {
        $this->ensureAssignedLegalCounsel($request, $document);
        $this->ensureValidatedReviewForm($document);

        $validated = $request->validate([
            'remarks' => [
                'required',
                'string',
                'max:5000',
            ],
        ]);

        if ($document->status !== 'Under Legal Review') {
            return response()->json([
                'message' =>
                    'Only documents under legal review can be returned for corrections.',
            ], 422);
        }

        DB::transaction(function () use (
            $request,
            $document,
            $validated
        ): void {
            $previousStatus = $document->status;

            $document->update([
                'status' => 'Corrections Needed',
                'legal_notes' => $validated['remarks'],
                'updated_at' => now(),
            ]);

            $this->recordWorkflowEvent(
                $request,
                $document,
                'corrections_requested',
                $previousStatus,
                'Corrections Needed',
                $validated['remarks']
            );
            $this->notifications->revisionRequested(
                $document,
                $validated['remarks']
            );
        });

        return response()->json([
            'message' =>
                'Document returned for corrections.',
            'data' => $document->fresh(),
        ]);
    }

    /**
     * GET /api/departments/{departmentId}/documents
     * Return documents owned by one department.
     */
    public function departmentDocuments(
        Request $request,
        string $departmentId
    ): JsonResponse {
        $profile = $this->profile($request);

        if (
            $profile->role === 'department_staff'
            && $profile->department_id !== $departmentId
        ) {
            abort(404);
        }

        $documents = Document::query()
            ->with($this->documentRelationships())
            ->where('department_id', $departmentId)
            ->orderByDesc('submitted_at')
            ->get();

        return response()->json([
            'data' => $documents,
        ]);
    }

    private function profile(Request $request): object
    {
        return $request->attributes->get('auth_profile');
    }

    private function documentRelationships(): array
    {
        return [
            'department:id,name',
            'departments:id,name',
            'assignedIroStaffProfile:id,full_name,email,role',
            'assignedLegalCounselProfile:id,full_name,email,role',
            'files:id,document_id,uploaded_by,file_category,original_filename,mime_type,size,version,created_at',
            'reviewForm.preparer:id,full_name,email',
            'reviewForm.validator:id,full_name,email',
            'reviewForm.sentBackBy:id,full_name,email',
        ];
    }

    private function requireDepartment(Request $request): string
    {
        $departmentId = $this->profile($request)->department_id;

        if (! $departmentId) {
            abort(422, 'The authenticated profile has no assigned department.');
        }

        return $departmentId;
    }

    private function ensureCanView(
        Request $request,
        Document $document
    ): void {
        $profile = $this->profile($request);

        $allowed = match ($profile->role) {
            'department_staff' =>
                $document->department_id === $profile->department_id
                || $document->submitted_by === $profile->id,
            'legal_counsel' =>
                $document->assigned_legal_counsel === $profile->id,
            'iro_staff' =>
                $document->status === 'Submitted'
                || $document->assigned_iro_staff === $profile->id,
            'iro_admin', 'super_admin' => true,
            default => false,
        };

        if (! $allowed) {
            abort(404);
        }
    }

    private function ensureAssignedLegalCounsel(
        Request $request,
        Document $document
    ): void {
        if (
            $document->assigned_legal_counsel
            !== $this->profile($request)->id
        ) {
            abort(404);
        }
    }

    private function ensureValidatedReviewForm(Document $document): void
    {
        $form = $document->reviewForm;

        if (
            ! $form
            || $form->review_form_status !== 'validated'
            || ! $form->validated_by
            || ! $form->validated_at
        ) {
            abort(422, 'A validated IRO Review Form is required for legal review.');
        }
    }

    private function recordWorkflowEvent(
        Request $request,
        Document $document,
        string $eventType,
        ?string $fromStatus,
        string $toStatus,
        ?string $notes = null
    ): void {
        $profile = $this->profile($request);

        WorkflowEvent::create([
            'document_id' => $document->id,
            'actor_id' => $profile->id,
            'actor_role' => $profile->role,
            'event_type' => $eventType,
            'from_status' => $fromStatus,
            'to_status' => $toStatus,
            'notes' => $notes,
            'created_at' => now(),
        ]);
    }
}
