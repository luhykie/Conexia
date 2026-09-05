<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Models\DocumentDepartmentReview;
use App\Models\AuditLog;
use App\Models\Profile;
use App\Services\TrackingNumberService;
use App\Support\DocumentPayload;
use App\Support\Pagination;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class DepartmentDocumentController extends Controller
{
    public function __construct(
        private readonly TrackingNumberService $trackingNumbers
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $profile = $this->departmentProfile($request);
        $options = Pagination::options(
            $request,
            ['submitted_at', 'updated_at', 'tracking_number', 'status'],
            'submitted_at',
            Document::workflowStatuses()
        );
        $operator = Pagination::searchOperator();

        $documents = Document::query()
            ->with('department')
            ->where(function ($query) use ($profile) {
                $query->where('department_id', $profile->department_id)
                    ->orWhere(function ($partnerQuery) use ($profile) {
                        $partnerQuery->where('partner_department_id', $profile->department_id)
                            ->whereNotNull('department_review_routed_at');
                    });
            })
            ->when(
                $options['search'] !== '',
                fn ($query) => $query->where(function ($builder) use ($options, $operator) {
                    $builder
                        ->where('tracking_number', $operator, "%{$options['search']}%")
                        ->orWhere('title', $operator, "%{$options['search']}%")
                        ->orWhere('partner_institution', $operator, "%{$options['search']}%");
                })
            )
            ->when(
                $options['status'],
                fn ($query) => $query->where('status', $options['status'])
            )
            ->orderBy($options['sort'], $options['direction'])
            ->paginate(
                $options['per_page'],
                ['*'],
                'page',
                $options['page']
            );

        $items = $documents
            ->map(fn (Document $document): array =>
                DocumentPayload::make($document)
            )
            ->values();

        return $this->success(
            'Department documents loaded successfully.',
            $items,
            [
                'documents' => $items,
                'meta' => Pagination::meta($documents),
            ]
        );
    }

    public function store(Request $request): JsonResponse
    {
        $profile = $this->departmentProfile($request);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'document_type' => ['required', 'string', 'max:100'],
            'partnership_scope' => [
                'required',
                Rule::in(['Local', 'International']),
            ],
            'partner_institution' => ['required', 'string', 'max:255'],
            'partner_email' => ['nullable', 'email', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'partnership_type' => ['nullable', 'string', 'max:100'],
            'contact_person' => ['nullable', 'string', 'max:255'],
            'contact_position' => ['nullable', 'string', 'max:255'],
            'contact_email' => ['nullable', 'email', 'max:255'],
            'contact_number' => ['nullable', 'string', 'max:100'],
            'requested_completion_date' => ['nullable', 'date'],
            'urgency' => ['nullable', 'string', 'max:50'],
            'effective_date' => ['nullable', 'date'],
            'expiry_date' => [
                'nullable',
                'date',
                'after_or_equal:effective_date',
            ],
            'renewal_notice_days' => [
                'nullable',
                'integer',
                'min:0',
                'max:3650',
            ],
            'renewal_status' => [
                'nullable',
                Rule::in(Document::renewalStatuses()),
            ],
            'partner_department_id' => ['nullable', 'uuid', 'exists:departments,id'],
        ]);

        if (
            !empty($validated['partner_department_id']) &&
            $validated['partnership_scope'] !== 'Local'
        ) {
            throw ValidationException::withMessages([
                'partner_department_id' => 'Partner departments are only available for Local submissions.',
            ]);
        }

        $document = $this->createDocumentWithTrackingNumber(
            $validated,
            $profile
        );

        return $this->success(
            'Document submitted successfully.',
            DocumentPayload::make($document),
            ['document' => DocumentPayload::make($document)]
        );
    }

    private function createDocumentWithTrackingNumber(
        array $validated,
        Profile $profile
    ): Document {
        for ($attempt = 1; $attempt <= 3; $attempt++) {
            try {
                return DB::transaction(function () use ($validated, $profile) {
                    $createdAt = now();

                    $partnerDepartmentId = $validated['partner_department_id'] ?? null;
                    if ($partnerDepartmentId === $profile->department_id) {
                        throw ValidationException::withMessages(['partner_department_id' => 'Please select a different partner department.']);
                    }
                    $document = Document::query()->create([
                        ...$validated,
                        'tracking_number' => $this->trackingNumbers
                            ->generateForDate($createdAt),
                        'renewal_status' => $validated['renewal_status'] ??
                            ($validated['expiry_date'] ?? null
                                ? Document::RENEWAL_ACTIVE
                                : Document::RENEWAL_NOT_REQUIRED),
                        'department_id' => $profile->department_id,
                        'submitted_by' => $profile->id,
                        'status' => $partnerDepartmentId ? Document::STATUS_DEPARTMENT_REVIEW : Document::STATUS_LOGGED,
                        'submitted_at' => $createdAt,
                        // This is the point at which “Submit for Review”
                        // officially delivers a departmental submission.
                        'department_review_routed_at' => $partnerDepartmentId ? $createdAt : null,
                    ]);
                    if ($partnerDepartmentId) {
                        foreach ([$profile->department_id, $partnerDepartmentId] as $departmentId) {
                            DocumentDepartmentReview::query()->create(['document_id' => $document->id, 'department_id' => $departmentId, 'version' => 1]);
                        }
                    }
                    AuditLog::query()->create([
                        'actor_id' => $profile->id,
                        'document_id' => $document->id,
                        'action' => 'department.submission.created',
                    ]);
                    return $document;
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

    public function resubmit(
        Request $request,
        string $id
    ): JsonResponse {
        $profile = $this->departmentProfile($request);
        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'document_type' => ['sometimes', 'required', 'string', 'max:100'],
            'partnership_scope' => ['sometimes', 'required', Rule::in(['Local', 'International'])],
            'partner_institution' => ['sometimes', 'required', 'string', 'max:255'],
            'partner_email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'partnership_type' => ['sometimes', 'nullable', 'string', 'max:100'],
            'contact_person' => ['sometimes', 'nullable', 'string', 'max:255'],
            'contact_position' => ['sometimes', 'nullable', 'string', 'max:255'],
            'contact_email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'contact_number' => ['sometimes', 'nullable', 'string', 'max:100'],
            'requested_completion_date' => ['sometimes', 'nullable', 'date'],
            'urgency' => ['sometimes', 'nullable', 'string', 'max:50'],
            'effective_date' => ['sometimes', 'nullable', 'date'],
            'expiry_date' => ['sometimes', 'nullable', 'date'],
        ]);

        $document = DB::transaction(function () use ($id, $profile, $validated) {
            $document = Document::query()
                ->whereKey($id)
                ->where('department_id', $profile->department_id)
                ->lockForUpdate()
                ->firstOrFail();

            if (
                $document->status !==
                Document::STATUS_CORRECTIONS_NEEDED
            ) {
                throw ValidationException::withMessages([
                    'status' => 'Only documents needing corrections can be resubmitted.',
                ]);
            }

            $effectiveDate = $validated['effective_date'] ?? $document->effective_date;
            $expiryDate = $validated['expiry_date'] ?? $document->expiry_date;
            if ($effectiveDate && $expiryDate && $expiryDate < $effectiveDate) {
                throw ValidationException::withMessages([
                    'expiry_date' => 'The expiry date must be on or after the effective date.',
                ]);
            }

            $update = [
                ...$validated,
                'status' => $document->partner_department_id ? Document::STATUS_DEPARTMENT_REVIEW : Document::STATUS_LOGGED,
                'legal_notes' => null,
                'department_review_routed_at' => $document->partner_department_id ? now() : null,
            ];
            if ($document->partner_department_id) {
                $version = $document->department_review_version + 1;
                $update['department_review_version'] = $version;
                foreach ([$document->department_id, $document->partner_department_id] as $departmentId) {
                    DocumentDepartmentReview::query()->create(['document_id' => $document->id, 'department_id' => $departmentId, 'version' => $version]);
                }
            }
            $document->update($update);

            AuditLog::query()->create([
                'actor_id' => $profile->id,
                'document_id' => $document->id,
                'action' => 'department.revision.resubmitted',
                'metadata' => [
                    'review_version' => $document->department_review_version,
                    'previous_status' => Document::STATUS_CORRECTIONS_NEEDED,
                    'new_status' => $document->status,
                    'corrected_fields' => array_keys($validated),
                ],
            ]);

            return $document->refresh();
        });

        return $this->success(
            'Document resubmitted successfully.',
            DocumentPayload::make($document),
            ['document' => DocumentPayload::make($document)]
        );
    }

    private function departmentProfile(Request $request): Profile
    {
        $profile = $request->attributes->get(
            'authenticated_profile'
        );

        if (!$profile || !$profile->department_id) {
            abort(403, 'Department Staff access is required.');
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
