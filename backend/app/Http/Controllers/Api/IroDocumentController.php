<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Department;
use App\Models\Document;
use App\Models\Profile;
use App\Services\TrackingNumberService;
use App\Support\DocumentPayload;
use App\Support\Pagination;
use Illuminate\Database\QueryException;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Rule;

class IroDocumentController extends Controller
{
    private ?Collection $activeLegalCounsel = null;

    private ?Collection $departments = null;

    public function incoming(Request $request): JsonResponse
    {
        $profile = $this->ensureIro($request);

        return $this->documents(
            'Incoming documents loaded successfully.',
            $request,
            'submitted_at',
            $profile->role === Profile::ROLE_IRO_ADMIN
                ? [
                    Document::STATUS_LOGGED,
                    Document::STATUS_CORRECTION_REQUIRED,
                ]
                : [
                    Document::STATUS_SUBMITTED,
                    Document::STATUS_LOGGED,
                    Document::STATUS_UNDER_LEGAL_REVIEW,
                    Document::STATUS_CORRECTIONS_NEEDED,
                    Document::STATUS_APPROVED,
                    Document::STATUS_PENDING_NOTARIZATION,
                    Document::STATUS_NOTARIZED,
                ],
            $profile,
            $profile->role === Profile::ROLE_IRO_ADMIN
        );
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $profile = $this->ensureIro($request);

        $document = Document::query()
            ->with(['department', 'submitter'])
            ->whereKey($id)
            ->firstOrFail();

        if (
            $profile->role === Profile::ROLE_IRO_STAFF &&
            !in_array($document->status, [
                Document::STATUS_SUBMITTED,
                Document::STATUS_LOGGED,
                Document::STATUS_UNDER_LEGAL_REVIEW,
                Document::STATUS_CORRECTIONS_NEEDED,
                Document::STATUS_APPROVED,
                Document::STATUS_PENDING_NOTARIZATION,
                Document::STATUS_NOTARIZED,
            ], true)
        ) {
            throw new \Symfony\Component\HttpKernel\Exception\NotFoundHttpException(
                'The requested document could not be found.'
            );
        }

        $payload = [
            ...DocumentPayload::make($document),
            'created_by' => $document->submitter
                ? [
                    'id' => $document->submitter->id,
                    'full_name' => $document->submitter->full_name,
                    'email' => $document->submitter->email,
                    'role' => $document->submitter->role,
                ]
                : null,
            'current_assignment' => $this->currentAssignment($document),
            'reassignment_destinations' =>
                $this->reassignmentDestinations($document),
        ];

        return $this->success(
            'Document loaded successfully.',
            $payload,
            ['document' => $payload]
        );
    }

    public function status(Request $request): JsonResponse
    {
        $profile = $this->ensureIro($request);

        return $this->documents(
            'Status documents loaded successfully.',
            $request,
            'updated_at',
            null,
            $profile
        );
    }

    public function store(Request $request): JsonResponse
    {
        $profile = $this->ensureIro($request);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'document_type' => [
                'required',
                'string',
                'in:MOA,MOU,MOF',
            ],
            'department_id' => ['present', 'nullable', 'uuid', 'exists:departments,id'],
            'partner_institution' => ['required', 'string', 'max:255'],
            'partner_email' => ['nullable', 'email', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'partnership_type' => ['required', 'string', 'max:255'],
            'partnership_scope' => [
                'required',
                Rule::in(['Departmental', 'Local', 'International']),
            ],
            'contact_person' => ['required', 'string', 'max:255'],
            'contact_position' => ['nullable', 'string', 'max:255'],
            'contact_email' => ['required', 'email', 'max:255'],
            'contact_number' => ['nullable', 'string', 'max:100'],
            'urgency' => ['required', 'string', 'max:255'],
            'requested_completion_date' => ['nullable', 'date'],
        ]);

        $document = $this->createDocumentWithTrackingNumber(
            $validated,
            $profile,
            Document::STATUS_SUBMITTED
        );

        AuditLog::query()->create([
            'actor_id' => $document->submitted_by,
            'document_id' => $document->id,
            'action' => 'iro_admin.document.created',
            'metadata' => [
                'tracking_number' => $document->tracking_number,
                'document_type' => $document->document_type,
                'partner_institution' => $document->partner_institution,
                'urgency' => $document->urgency,
            ],
        ]);

        return $this->documentResponse(
            'Document created successfully.',
            $document
        );
    }

    private function createDocumentWithTrackingNumber(
        array $validated,
        Profile $profile,
        string $status
    ): Document {
        for ($attempt = 1; $attempt <= 3; $attempt++) {
            try {
                return DB::transaction(function () use (
                    $validated,
                    $profile,
                    $status
                ) {
                    $createdAt = now();

                    return Document::query()->create([
                        ...$validated,
                        'tracking_number' => app(TrackingNumberService::class)
                            ->generateForDate($createdAt),
                        'renewal_status' => $validated['expiry_date'] ?? null
                            ? Document::RENEWAL_ACTIVE
                            : Document::RENEWAL_NOT_REQUIRED,
                        'submitted_by' => $profile->id,
                        'status' => $status,
                        'submitted_at' => $createdAt,
                    ]);
                });
            } catch (QueryException $exception) {
                if ($attempt === 3 ||
                    !$this->isDuplicateTrackingNumberError($exception->getMessage())
                ) {
                    throw $exception;
                }
            }
        }

        throw new \RuntimeException('Unable to generate a unique tracking number.');
    }

    private function isDuplicateTrackingNumberError(string $message): bool
    {
        return str_contains($message, 'documents_tracking_number_unique') ||
            str_contains($message, 'documents_tracking_number_unique_idx') ||
            str_contains($message, 'tracking_number');
    }

    public function markLogged(
        Request $request,
        string $id
    ): JsonResponse {
        $this->ensureIro($request);

        $document = DB::transaction(function () use ($id) {
            $document = $this->lockedDocument($id);

            if ($document->status !== Document::STATUS_SUBMITTED) {
                throw ValidationException::withMessages([
                    'status' => 'Only submitted documents can be logged.',
                ]);
            }

            $document->update([
                'status' => Document::STATUS_LOGGED,
            ]);

            return $document->refresh();
        });

        return $this->documentResponse(
            'Document marked as logged.',
            $document
        );
    }

    public function forwardToAdmin(
        Request $request,
        string $id
    ): JsonResponse {
        $profile = $this->ensureIro($request);
        $validated = $request->validate([
            'remarks' => ['nullable', 'string', 'max:2000'],
        ]);

        $document = DB::transaction(function () use ($id, $profile, $validated) {
            $document = $this->lockedDocument($id);

            if ($document->status !== Document::STATUS_SUBMITTED) {
                throw ValidationException::withMessages([
                    'status' => 'Only submitted documents can be forwarded to IRO Admin.',
                ]);
            }

            $previousStatus = $document->status;
            $document->update(['status' => Document::STATUS_LOGGED]);

            AuditLog::query()->create([
                'actor_id' => $profile->id,
                'document_id' => $document->id,
                'action' => 'iro_staff.document.forwarded_to_admin',
                'metadata' => [
                    'remarks' => $validated['remarks'] ?? null,
                    'previous_status' => $previousStatus,
                    'new_status' => Document::STATUS_LOGGED,
                    'actor' => [
                        'id' => $profile->id,
                        'role' => $profile->role,
                    ],
                    'ownership' => $this->ownershipMetadata($document),
                    'destination' => [
                        'type' => 'iro_admin_validation_queue',
                    ],
                ],
            ]);

            return $document->refresh();
        });

        return $this->documentResponse(
            'Document submitted to IRO Admin successfully.',
            $document
        );
    }

    public function returnForCorrection(
        Request $request,
        string $id
    ): JsonResponse {
        $profile = $this->ensureIro($request);
        $validated = $request->validate([
            'remarks' => ['required', 'string', 'min:1', 'max:2000'],
        ]);

        $document = DB::transaction(function () use ($id, $profile, $validated) {
            $document = $this->lockedDocument($id);

            if ($document->status !== Document::STATUS_SUBMITTED) {
                throw ValidationException::withMessages([
                    'status' => 'Only submitted documents can be returned for correction.',
                ]);
            }

            $previousStatus = $document->status;
            $document->update([
                'status' => Document::STATUS_CORRECTIONS_NEEDED,
            ]);

            $ownership = $this->ownershipMetadata($document);

            AuditLog::query()->create([
                'actor_id' => $profile->id,
                'document_id' => $document->id,
                'action' => 'iro_staff.document.returned_for_correction',
                'metadata' => [
                    'remarks' => trim($validated['remarks']),
                    'previous_status' => $previousStatus,
                    'new_status' => Document::STATUS_CORRECTIONS_NEEDED,
                    'actor' => [
                        'id' => $profile->id,
                        'role' => $profile->role,
                    ],
                    'ownership' => $ownership,
                    'destination' => $ownership,
                ],
            ]);

            return $document->refresh();
        });

        return $this->documentResponse(
            'Document returned for correction successfully.',
            $document
        );
    }

    private function ownershipMetadata(Document $document): array
    {
        $document->loadMissing('department');

        return [
            'submitted_by' => $document->submitted_by,
            'department_id' => $document->department_id,
            'department' => $document->department
                ? [
                    'id' => $document->department->id,
                    'code' => $document->department->code,
                    'name' => $document->department->name,
                ]
                : null,
        ];
    }

    public function assignLegal(
        Request $request,
        string $id
    ): JsonResponse {
        $this->ensureIro($request);

        $validated = $request->validate([
            'legal_counsel_id' => [
                'required',
                'uuid',
                'exists:profiles,id',
            ],
        ]);

        $legalCounsel = Profile::query()
            ->whereKey($validated['legal_counsel_id'])
            ->where('role', Profile::ROLE_LEGAL_COUNSEL)
            ->where('is_active', true)
            ->first();

        if (!$legalCounsel) {
            throw ValidationException::withMessages([
                'legal_counsel_id' => 'Select an active Legal Counsel user.',
            ]);
        }

        $document = DB::transaction(function () use (
            $id,
            $legalCounsel
        ) {
            $document = $this->lockedDocument($id);

            if ($document->status !== Document::STATUS_LOGGED) {
                throw ValidationException::withMessages([
                    'status' => 'Only logged documents can be assigned.',
                ]);
            }

            $document->update([
                'assigned_legal_counsel' => $legalCounsel->id,
                'status' => Document::STATUS_UNDER_LEGAL_REVIEW,
                'legal_notes' => null,
            ]);

            return $document->refresh();
        });

        return $this->documentResponse(
            'Document assigned to Legal Counsel.',
            $document
        );
    }

    public function returnFromAdminReview(Request $request, string $id): JsonResponse
    {
        $profile = $this->ensureIroAdmin($request);
        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:3', 'max:2000'],
        ]);

        $document = DB::transaction(function () use ($id, $profile, $validated) {
            $document = $this->lockedDocument($id);
            $this->requireLoggedAdminReview($document);
            $previousStatus = $document->status;
            $document->update([
                'status' => Document::STATUS_CORRECTIONS_NEEDED,
                'assigned_legal_counsel' => null,
            ]);
            $this->logAdminReviewDecision(
                $document,
                $profile,
                'iro_admin.review.returned_for_revision',
                $previousStatus,
                Document::STATUS_CORRECTIONS_NEEDED,
                ['reason' => trim($validated['reason']), 'destination' => $this->ownershipMetadata($document)]
            );
            return $document->refresh();
        });

        return $this->documentResponse('Document returned for revision.', $document);
    }

    public function validateAndRouteToLegal(Request $request, string $id): JsonResponse
    {
        $profile = $this->ensureIroAdmin($request);
        $validated = $request->validate([
            'legal_counsel_id' => ['required', 'uuid', 'exists:profiles,id'],
            'comments' => ['nullable', 'string', 'max:2000'],
        ]);
        $legalCounsel = Profile::query()
            ->whereKey($validated['legal_counsel_id'])
            ->where('role', Profile::ROLE_LEGAL_COUNSEL)
            ->where('is_active', true)
            ->first();
        if (!$legalCounsel) {
            throw ValidationException::withMessages(['legal_counsel_id' => 'Select an active Legal Counsel user.']);
        }

        $document = DB::transaction(function () use ($id, $profile, $validated, $legalCounsel) {
            $document = $this->lockedDocument($id);
            $this->requireLoggedAdminReview($document);
            $previousStatus = $document->status;
            $document->update([
                'status' => Document::STATUS_UNDER_LEGAL_REVIEW,
                'assigned_legal_counsel' => $legalCounsel->id,
                'legal_notes' => null,
            ]);
            $this->logAdminReviewDecision(
                $document,
                $profile,
                'iro_admin.review.validated_and_routed_to_legal',
                $previousStatus,
                Document::STATUS_UNDER_LEGAL_REVIEW,
                [
                    'comments' => isset($validated['comments']) ? trim($validated['comments']) : null,
                    'destination' => ['type' => 'legal_counsel', 'id' => $legalCounsel->id, 'name' => $legalCounsel->full_name],
                ]
            );
            return $document->refresh();
        });

        return $this->documentResponse('IRO Admin review validated and routed to Legal Counsel.', $document);
    }

    public function routeLegalCorrectionToDepartment(
        Request $request,
        string $id
    ): JsonResponse {
        $profile = $this->ensureIroAdmin($request);

        $document = DB::transaction(function () use ($id, $profile) {
            $document = $this->lockedDocument($id);

            if ($document->status !== Document::STATUS_CORRECTION_REQUIRED) {
                throw ValidationException::withMessages([
                    'status' => 'Only legal correction requests awaiting IRO Admin can be routed to the department.',
                ]);
            }

            $previousStatus = $document->status;
            $document->update([
                'status' => Document::STATUS_CORRECTIONS_NEEDED,
            ]);

            $this->logAdminReviewDecision(
                $document,
                $profile,
                'iro_admin.legal_correction.routed_to_department',
                $previousStatus,
                Document::STATUS_CORRECTIONS_NEEDED,
                ['destination' => $this->ownershipMetadata($document)]
            );

            return $document->refresh();
        });

        return $this->documentResponse(
            'Legal correction request routed to the department.',
            $document
        );
    }

    private function requireLoggedAdminReview(Document $document): void
    {
        if ($document->status !== Document::STATUS_LOGGED) {
            throw ValidationException::withMessages([
                'status' => 'Only logged documents awaiting IRO Admin review can be processed.',
            ]);
        }
    }

    private function logAdminReviewDecision(
        Document $document,
        Profile $profile,
        string $action,
        string $previousStatus,
        string $newStatus,
        array $metadata
    ): void {
        $latestFile = $document->files()->whereNull('deleted_at')->latest('version')->first();
        AuditLog::query()->create([
            'actor_id' => $profile->id,
            'document_id' => $document->id,
            'document_file_id' => $latestFile?->id,
            'action' => $action,
            'metadata' => [
                ...$metadata,
                'previous_status' => $previousStatus,
                'new_status' => $newStatus,
                'reviewer' => ['id' => $profile->id, 'name' => $profile->full_name, 'role' => $profile->role],
                'document_version' => $latestFile?->version,
                'annotation_count' => AuditLog::query()->where('document_id', $document->id)->where('action', 'document_file.annotated')->count(),
                'decided_at' => now()->toISOString(),
            ],
        ]);
    }

    public function reassignLegal(
        Request $request,
        string $id
    ): JsonResponse {
        $profile = $this->ensureIro($request);

        $validated = $request->validate([
            'destination_type' => [
                'required',
                'string',
                'in:department,partner,legal_counsel',
            ],
            'destination_id' => [
                'nullable',
                'uuid',
            ],
            'reason' => ['required', 'string', 'min:5', 'max:1000'],
        ]);

        $document = DB::transaction(function () use (
            $id,
            $profile,
            $validated
        ) {
            $document = $this->lockedDocument($id);

            if (
                in_array($document->status, [
                    Document::STATUS_ARCHIVED,
                    Document::STATUS_NOTARIZED,
                ], true)
            ) {
                throw ValidationException::withMessages([
                    'status' => 'Finalized or archived documents cannot be reassigned.',
                ]);
            }

            $destination = $this->findValidDestination(
                $document,
                $validated['destination_type'],
                $validated['destination_id'] ?? null
            );

            if (!$destination) {
                throw ValidationException::withMessages([
                    'destination' => 'Select a valid involved reassignment destination.',
                ]);
            }

            $currentAssignment = $this->currentAssignment($document);

            if ($currentAssignment['key'] === $destination['key']) {
                throw ValidationException::withMessages([
                    'destination' => 'Select a different reassignment destination.',
                ]);
            }

            if ($destination['type'] === 'legal_counsel') {
                $document->update([
                    'assigned_legal_counsel' => $destination['id'],
                    'status' => Document::STATUS_UNDER_LEGAL_REVIEW,
                ]);
            } else {
                $document->update([
                    'assigned_legal_counsel' => null,
                    'status' => Document::STATUS_CORRECTIONS_NEEDED,
                ]);
            }

            AuditLog::query()->create([
                'actor_id' => $profile->id,
                'document_id' => $document->id,
                'action' => 'iro_admin.document.reassigned',
                'metadata' => [
                    'tracking_number' => $document->tracking_number,
                    'previous_destination' => $currentAssignment,
                    'new_destination' => $destination,
                    'reason' => trim($validated['reason']),
                ],
            ]);

            return $document->refresh();
        });

        return $this->documentResponse(
            'Document reassigned successfully.',
            $document
        );
    }

    public function archive(
        Request $request,
        string $id
    ): JsonResponse {
        $profile = $this->ensureIro($request);

        $document = DB::transaction(function () use ($id, $profile) {
            $document = $this->lockedDocument($id);

            if ($document->status !== Document::STATUS_NOTARIZED) {
                throw ValidationException::withMessages([
                    'status' => 'Only notarized documents can be archived.',
                ]);
            }

            $document->update([
                'status' => Document::STATUS_ARCHIVED,
                'archived_at' => now(),
                'archived_by' => $profile->id,
            ]);

            return $document->refresh();
        });

        return $this->documentResponse(
            'Document archived successfully.',
            $document
        );
    }

    public function unarchive(
        Request $request,
        string $id
    ): JsonResponse {
        $profile = $this->ensureIro($request);

        $document = DB::transaction(function () use ($id, $profile) {
            $document = $this->lockedDocument($id);

            if ($document->status !== Document::STATUS_ARCHIVED) {
                throw ValidationException::withMessages([
                    'status' => 'Only archived documents can be unarchived.',
                ]);
            }

            $document->update([
                'status' => Document::STATUS_NOTARIZED,
                'archived_at' => null,
                'archived_by' => null,
            ]);

            AuditLog::query()->create([
                'actor_id' => $profile->id,
                'document_id' => $document->id,
                'action' => 'iro_admin.document.unarchived',
                'metadata' => [
                    'restored_status' => Document::STATUS_NOTARIZED,
                ],
            ]);

            return $document->refresh();
        });

        return $this->documentResponse(
            'Document unarchived successfully.',
            $document
        );
    }

    private function documents(
        string $message,
        Request $request,
        string $orderColumn,
        ?array $statuses = null,
        ?Profile $profile = null,
        bool $adminReviewQueue = false
    ): JsonResponse {
        $profile ??= $this->ensureIro($request);
        $options = Pagination::options(
            $request,
            ['submitted_at', 'updated_at', 'tracking_number', 'status'],
            $orderColumn,
            $adminReviewQueue
                ? [...Document::workflowStatuses(), 'Revised']
                : Document::workflowStatuses()
        );
        $filters = $request->validate([
            'document_type' => [
                'nullable',
                Rule::in(['MOA', 'MOU', 'MOF']),
            ],
            'department' => ['nullable', 'string', 'max:100'],
            'partnership_scope' => [
                'nullable',
                Rule::in(['Local', 'International', 'Departmental']),
            ],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
        ]);
        $operator = Pagination::searchOperator();

        $query = Document::query()
            ->with('department')
            ->when(
                $profile->role === Profile::ROLE_IRO_ADMIN,
                fn ($query) => $query->with([
                    'legalCounsel',
                    'latestReassignment',
                ])
            )
            ->when(
                $adminReviewQueue,
                fn ($query) => $query->withExists([
                    'auditLogs as has_admin_revision' => fn ($auditQuery) =>
                        $auditQuery->where(
                            'action',
                            'iro_admin.review.returned_for_revision'
                        ),
                ])
            )
            ->when(
                $options['search'] !== '',
                function ($query) use ($options, $operator, $profile) {
                    $query->where(function ($builder) use ($options, $operator, $profile) {
                        $builder->where(
                            'tracking_number',
                            $operator,
                            "%{$options['search']}%"
                        );

                        if ($profile->role !== Profile::ROLE_IRO_STAFF) {
                            $builder
                                ->orWhere('title', $operator, "%{$options['search']}%")
                                ->orWhere('partner_institution', $operator, "%{$options['search']}%");
                        }

                        $builder->orWhereHas(
                            'department',
                            fn ($departmentQuery) => $departmentQuery
                                ->where('code', $operator, "%{$options['search']}%")
                                ->orWhere('name', $operator, "%{$options['search']}%")
                        );
                    });
                }
            )
            ->when(
                $options['status'] && (
                    !$adminReviewQueue ||
                    !in_array($options['status'], [
                        Document::STATUS_LOGGED,
                        'Revised',
                    ], true)
                ),
                fn ($query) => $query->where('status', $options['status'])
            )
            ->when(
                $adminReviewQueue && $options['status'] === 'Revised',
                fn ($query) => $query->whereHas(
                    'auditLogs',
                    fn ($auditQuery) => $auditQuery->where(
                        'action',
                        'iro_admin.review.returned_for_revision'
                    )
                )
            )
            ->when(
                $adminReviewQueue && $options['status'] === Document::STATUS_LOGGED,
                fn ($query) => $query->whereDoesntHave(
                    'auditLogs',
                    fn ($auditQuery) => $auditQuery->where(
                        'action',
                        'iro_admin.review.returned_for_revision'
                    )
                )
            )
            ->when(
                $filters['partnership_scope'] ?? null,
                fn ($query) => $query->where(
                    'partnership_scope',
                    $filters['partnership_scope']
                )
            )
            ->when(
                $filters['document_type'] ?? null,
                fn ($query) => $query->where(
                    'document_type',
                    $filters['document_type']
                )
            )
            ->when(
                $filters['department'] ?? null,
                fn ($query) => $query->whereHas(
                    'department',
                    fn ($departmentQuery) => $departmentQuery
                        ->where('code', $filters['department'])
                        ->orWhere('name', $filters['department'])
                )
            )
            ->when(
                $filters['date_from'] ?? null,
                fn ($query) => $query->whereDate(
                    'submitted_at',
                    '>=',
                    $filters['date_from']
                )
            )
            ->when(
                $filters['date_to'] ?? null,
                fn ($query) => $query->whereDate(
                    'submitted_at',
                    '<=',
                    $filters['date_to']
                )
            )
            ->orderBy($options['sort'], $options['direction']);

        if ($statuses !== null) {
            $query->whereIn('status', $statuses);
        }

        $statistics = [
            'active' => (clone $query)
                ->where('status', '!=', Document::STATUS_ARCHIVED)
                ->count(),
            'submitted' => (clone $query)
                ->where('status', Document::STATUS_SUBMITTED)
                ->count(),
            'pending' => (clone $query)
                ->whereIn('status', [
                    Document::STATUS_SUBMITTED,
                    Document::STATUS_LOGGED,
                    Document::STATUS_UNDER_LEGAL_REVIEW,
                    Document::STATUS_CORRECTIONS_NEEDED,
                ])
                ->count(),
            'older_than_three_days' => (clone $query)
                ->where('submitted_at', '<', now()->subDays(3))
                ->count(),
            'status_older_than_three_days' => (clone $query)
                ->where('updated_at', '<', now()->subDays(3))
                ->count(),
        ];

        $documents = $query->paginate(
            $options['per_page'],
            $profile->role === Profile::ROLE_IRO_STAFF
                ? [
                    'id',
                    'tracking_number',
                    'department_id',
                    'status',
                    'submitted_at',
                    'updated_at',
                    'expiry_date',
                    'renewal_status',
                ]
                : ['*'],
            'page',
            $options['page']
        );

        $items = $documents
            ->map(fn (Document $document): array =>
                $this->payloadFor($profile, $document, $adminReviewQueue)
            )
            ->values();

        return $this->success(
            $message,
            $items,
            [
                'documents' => $items,
                'meta' => Pagination::meta($documents),
                'statistics' => $statistics,
            ]
        );
    }

    private function payloadFor(
        Profile $profile,
        Document $document,
        bool $adminReviewQueue = false
    ): array
    {
        if ($profile->role !== Profile::ROLE_IRO_STAFF) {
            return [
                ...DocumentPayload::make($document),
                ...($adminReviewQueue ? [
                    'review_status' => $document->has_admin_revision
                        ? 'Revised'
                        : Document::STATUS_LOGGED,
                ] : []),
                'current_assignment' => $this->currentAssignment($document),
                'reassignment_destinations' =>
                    $this->reassignmentDestinations($document),
            ];
        }

        $document->loadMissing('department');

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
            'status' => $document->status,
            'submitted_at' => $document->submitted_at?->toISOString(),
            'updated_at' => $document->updated_at?->toISOString(),
            'expiry_date' => $document->expiry_date?->toDateString(),
            'renewal_status' => $document->renewal_status,
        ];
    }

    private function lockedDocument(string $id): Document
    {
        return Document::query()
            ->whereKey($id)
            ->lockForUpdate()
            ->firstOrFail();
    }

    private function documentResponse(
        string $message,
        Document $document
    ): JsonResponse {
        $payload = [
            ...DocumentPayload::make($document),
            'current_assignment' => $this->currentAssignment($document),
            'reassignment_destinations' =>
                $this->reassignmentDestinations($document),
        ];

        return $this->success(
            $message,
            $payload,
            ['document' => $payload]
        );
    }

    private function reassignmentDestinations(Document $document): array
    {
        if (
            in_array($document->status, [
                Document::STATUS_ARCHIVED,
                Document::STATUS_NOTARIZED,
            ], true)
        ) {
            return [];
        }

        $document->loadMissing('department');
        $destinations = [];

        if ($document->department) {
            $destinations[] = [
                'key' => 'department:'.$document->department->id,
                'type' => 'department',
                'id' => $document->department->id,
                'label' => $this->departmentLabel($document->department),
                'category' => 'Department',
            ];
        }

        $partnerDepartment = $this->partnerDepartment($document);

        if (
            $partnerDepartment &&
            $partnerDepartment->id !== $document->department_id
        ) {
            $destinations[] = [
                'key' => 'department:'.$partnerDepartment->id,
                'type' => 'department',
                'id' => $partnerDepartment->id,
                'label' => $this->departmentLabel($partnerDepartment),
                'category' => 'Department',
            ];
        } elseif ($document->partner_institution) {
            $destinations[] = [
                'key' => 'partner:'.sha1($document->partner_institution),
                'type' => 'partner',
                'id' => null,
                'label' => $document->partner_institution,
                'category' => $this->partnerCategory($document),
                'email' => $document->partner_email,
            ];
        }

        $this->activeLegalCounsel()
            ->each(function (Profile $legalCounsel) use (&$destinations) {
                $destinations[] = [
                    'key' => 'legal_counsel:'.$legalCounsel->id,
                    'type' => 'legal_counsel',
                    'id' => $legalCounsel->id,
                    'label' => $legalCounsel->full_name ?: $legalCounsel->email,
                    'category' => 'Legal Counsel',
                    'email' => $legalCounsel->email,
                ];
            });

        $current = $this->currentAssignment($document);

        return collect($destinations)
            ->unique('key')
            ->reject(fn (array $destination): bool =>
                $destination['key'] === $current['key']
            )
            ->values()
            ->all();
    }

    private function findValidDestination(
        Document $document,
        string $type,
        ?string $id
    ): ?array {
        return collect($this->reassignmentDestinations($document))
            ->first(fn (array $destination): bool =>
                $destination['type'] === $type &&
                ($destination['id'] ?? null) === $id
            );
    }

    private function currentAssignment(Document $document): array
    {
        $document->loadMissing(['legalCounsel', 'latestReassignment']);
        $latestReassignment = $document->latestReassignment;

        $destination = $latestReassignment?->metadata['new_destination'] ?? null;

        if (is_array($destination) && isset($destination['key'])) {
            return $destination;
        }

        if ($document->assigned_legal_counsel) {
            $legalCounsel = $document->legalCounsel;

            return [
                'key' => 'legal_counsel:'.$document->assigned_legal_counsel,
                'type' => 'legal_counsel',
                'id' => $document->assigned_legal_counsel,
                'label' => $legalCounsel?->full_name ?: 'Legal Counsel',
                'category' => 'Legal Counsel',
                'email' => $legalCounsel?->email,
            ];
        }

        return [
            'key' => 'none',
            'type' => 'none',
            'id' => null,
            'label' => 'Not assigned',
            'category' => 'Workflow',
        ];
    }

    private function partnerDepartment(Document $document): ?Department
    {
        if (!$document->partner_institution) {
            return null;
        }

        return $this->departments()
            ->first(function (Department $department) use ($document): bool {
                $partner = strtolower($document->partner_institution);

                return str_contains($partner, strtolower($department->code)) ||
                    str_contains($partner, strtolower($department->name));
            });
    }

    private function activeLegalCounsel(): Collection
    {
        return $this->activeLegalCounsel ??= Profile::query()
            ->where('role', Profile::ROLE_LEGAL_COUNSEL)
            ->where('is_active', true)
            ->orderBy('full_name')
            ->get();
    }

    private function departments(): Collection
    {
        return $this->departments ??= Department::query()->get();
    }

    private function departmentLabel(Department $department): string
    {
        return "{$department->code} - {$department->name}";
    }

    private function partnerCategory(Document $document): string
    {
        $email = strtolower((string) $document->partner_email);

        if ($email && !str_ends_with($email, '.ph')) {
            return 'International Partner';
        }

        return 'Local Partner';
    }

    private function ensureIro(Request $request): Profile
    {
        $profile = $request->attributes->get(
            'authenticated_profile'
        );

        if (!$profile) {
            abort(403, 'IRO Staff access is required.');
        }

        return $profile;
    }

    private function ensureIroAdmin(Request $request): Profile
    {
        $profile = $this->ensureIro($request);

        if ($profile->role !== Profile::ROLE_IRO_ADMIN) {
            abort(403, 'IRO Admin access is required.');
        }

        return $profile;
    }

    private function success(
        string $message,
        mixed $data,
        array $extra = []
    ): JsonResponse {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $data,
            ...$extra,
        ]);
    }
}
