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
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class IroDocumentController extends Controller
{
    public function __construct(
        private readonly TrackingNumberService $trackingNumbers
    ) {
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureIro($request);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'document_type' => [
                'required',
                'string',
                'in:MOA,MOU,MOF',
            ],
            'partner_institution' => ['required', 'string', 'max:255'],
            'partner_email' => ['nullable', 'email', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'department_id' => ['nullable', 'uuid', 'exists:departments,id'],
            'partnership_type' => [
                'required',
                'string',
                'in:New Partnership,Renewal',
            ],
            'partnership_scope' => [
                'required',
                'string',
                'in:Local,International',
            ],
            'contact_person' => ['required', 'string', 'max:255'],
            'contact_position' => ['nullable', 'string', 'max:255'],
            'contact_email' => ['required', 'email', 'max:255'],
            'contact_number' => ['nullable', 'string', 'max:100'],
            'urgency' => [
                'required',
                'string',
                'in:Normal,Urgent,Highly Urgent',
            ],
            'requested_completion_date' => [
                'nullable',
                'date',
            ],
        ]);

        $profile = $request->attributes->get(
            'authenticated_profile'
        );

        $document = $this->createDocumentWithTrackingNumber(
            $validated,
            $profile,
            Document::STATUS_LOGGED
        );

        AuditLog::query()->create([
            'actor_id' => $profile->id,
            'document_id' => $document->id,
            'action' => 'iro_admin.document.created',
            'metadata' => [
                'tracking_number' => $document->tracking_number,
                'document_type' => $document->document_type,
                'partner_institution' => $document->partner_institution,
                'department_id' => $document->department_id,
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
                        'tracking_number' => $this->trackingNumbers
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
                if (!$this->isTrackingNumberCollision($exception) || $attempt === 3) {
                    throw $exception;
                }
            }
        }

        abort(500, 'Unable to generate a tracking number.');
    }

    private function isTrackingNumberCollision(QueryException $exception): bool
    {
        $message = strtolower($exception->getMessage());

        return str_contains($message, 'documents_tracking_number_unique') ||
            str_contains($message, 'documents_tracking_number_unique_idx') ||
            str_contains($message, 'tracking_number');
    }

    public function incoming(Request $request): JsonResponse
    {
        $profile = $this->ensureIro($request);

        return $this->documents(
            'Incoming documents loaded successfully.',
            $request,
            'submitted_at',
            [
                Document::STATUS_SUBMITTED,
                Document::STATUS_LOGGED,
                Document::STATUS_UNDER_LEGAL_REVIEW,
                Document::STATUS_CORRECTIONS_NEEDED,
                Document::STATUS_APPROVED,
                Document::STATUS_PENDING_NOTARIZATION,
                Document::STATUS_NOTARIZED,
            ],
            $profile
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
        ?Profile $profile = null
    ): JsonResponse {
        $profile ??= $this->ensureIro($request);
        $options = Pagination::options(
            $request,
            ['submitted_at', 'updated_at', 'tracking_number', 'status'],
            $orderColumn,
            Document::workflowStatuses()
        );
        $operator = Pagination::searchOperator();

        $query = Document::query()
            ->with('department')
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
                $options['status'],
                fn ($query) => $query->where('status', $options['status'])
            )
            ->orderBy($options['sort'], $options['direction']);

        if ($statuses !== null) {
            $query->whereIn('status', $statuses);
        }

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
                $this->payloadFor($profile, $document)
            )
            ->values();

        return $this->success(
            $message,
            $items,
            [
                'documents' => $items,
                'meta' => Pagination::meta($documents),
            ]
        );
    }

    private function payloadFor(Profile $profile, Document $document): array
    {
        if ($profile->role !== Profile::ROLE_IRO_STAFF) {
            return [
                ...DocumentPayload::make($document),
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

        Profile::query()
            ->where('role', Profile::ROLE_LEGAL_COUNSEL)
            ->where('is_active', true)
            ->orderBy('full_name')
            ->get()
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
        $latestReassignment = AuditLog::query()
            ->where('document_id', $document->id)
            ->where('action', 'iro_admin.document.reassigned')
            ->latest('created_at')
            ->first();

        $destination = $latestReassignment?->metadata['new_destination'] ?? null;

        if (is_array($destination) && isset($destination['key'])) {
            return $destination;
        }

        if ($document->assigned_legal_counsel) {
            $legalCounsel = Profile::query()
                ->whereKey($document->assigned_legal_counsel)
                ->first();

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

        return Department::query()
            ->get()
            ->first(function (Department $department) use ($document): bool {
                $partner = strtolower($document->partner_institution);

                return str_contains($partner, strtolower($department->code)) ||
                    str_contains($partner, strtolower($department->name));
            });
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
