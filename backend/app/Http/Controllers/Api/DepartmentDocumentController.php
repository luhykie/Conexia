<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Models\Profile;
use App\Services\TrackingNumberService;
use App\Services\SupabaseSubmissionGateway;
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
        private readonly TrackingNumberService $trackingNumbers,
        private readonly SupabaseSubmissionGateway $submissionGateway
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

        $documents = collect($this->submissionGateway->listSubmissions(
            $request->bearerToken(),
            [
                'submitted_by' => 'eq.'.$profile->id,
            ]
        ));

        $items = $documents
            ->filter(function (array $document) use ($options): bool {
                if ($options['search'] === '') {
                    return true;
                }

                $search = strtolower($options['search']);

                return str_contains(strtolower((string) ($document['tracking_number'] ?? '')), $search)
                    || str_contains(strtolower((string) ($document['title'] ?? '')), $search)
                    || str_contains(strtolower((string) ($document['partner_institution'] ?? '')), $search);
            })
            ->when(
                $options['status'],
                fn ($collection) => $collection->filter(
                    fn (array $document): bool => (string) ($document['status'] ?? '') === $options['status']
                )
            )
            ->sortByDesc($options['sort'])
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
            'partner_institution' => ['required', 'string', 'max:255'],
            'partner_email' => ['nullable', 'email', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
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
        ]);

        $document = $this->submissionGateway->createSubmission(
            $request->bearerToken(),
            [
                ...$validated,
                'tracking_number' => $this->trackingNumbers
                    ->generateForDate(now()),
                'department_id' => $profile->department_id,
                'submitted_by' => $profile->id,
                'created_by' => $profile->id,
                'office' => $profile->office,
                'department' => $profile->department,
                'status' => Document::STATUS_SUBMITTED,
                'current_stage' => 'iro_staff',
                'submitted_at' => now()->toIso8601String(),
            ]
        );

        return $this->success(
            'Document submitted successfully.',
            $document,
            ['document' => $document]
        );
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $profile = $this->departmentProfile($request);

        $document = $this->submissionGateway->getSubmission(
            $request->bearerToken(),
            $id
        );

        if (! $document || (string) ($document['submitted_by'] ?? '') !== (string) $profile->id) {
            abort(404, 'Department document not found.');
        }

        return $this->success(
            'Department document loaded successfully.',
            $document,
            ['document' => $document]
        );
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $profile = $this->departmentProfile($request);

        $document = $this->submissionGateway->getSubmission(
            $request->bearerToken(),
            $id
        );

        if (! $document || (string) ($document['submitted_by'] ?? '') !== (string) $profile->id) {
            abort(404, 'Department document not found.');
        }

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'document_type' => ['sometimes', 'required', 'string', 'max:100'],
            'partner_institution' => ['sometimes', 'required', 'string', 'max:255'],
            'partner_email' => ['nullable', 'email', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'effective_date' => ['nullable', 'date'],
            'expiry_date' => ['nullable', 'date', 'after_or_equal:effective_date'],
            'renewal_notice_days' => ['nullable', 'integer', 'min:0', 'max:3650'],
            'renewal_status' => ['nullable', Rule::in(Document::renewalStatuses())],
            'file_name' => ['nullable', 'string', 'max:255'],
            'storage_path' => ['nullable', 'string', 'max:1000'],
            'status' => ['nullable', 'string', 'max:255'],
        ]);

        $updated = $this->submissionGateway->updateSubmission(
            $request->bearerToken(),
            $id,
            array_filter($validated, static fn ($value) => $value !== null)
        );

        return $this->success(
            'Department document updated successfully.',
            $updated,
            ['document' => $updated]
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

                    return Document::query()->create([
                        ...$validated,
                        'tracking_number' => $this->trackingNumbers
                            ->generateForDate($createdAt),
                        'renewal_status' => $validated['renewal_status'] ??
                            ($validated['expiry_date'] ?? null
                                ? Document::RENEWAL_ACTIVE
                                : Document::RENEWAL_NOT_REQUIRED),
                        'department_id' => $profile->department_id,
                        'submitted_by' => $profile->id,
                        'status' => Document::STATUS_SUBMITTED,
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

    public function resubmit(
        Request $request,
        string $id
    ): JsonResponse {
        $profile = $this->departmentProfile($request);

        $document = $this->submissionGateway->getSubmission(
            $request->bearerToken(),
            $id
        );

        if (! $document || (string) ($document['submitted_by'] ?? '') !== (string) $profile->id) {
            abort(404, 'Department document not found.');
        }

        if (
            ($document['status'] ?? null) !==
            Document::STATUS_CORRECTIONS_NEEDED
        ) {
            throw ValidationException::withMessages([
                'status' => 'Only documents needing corrections can be resubmitted.',
            ]);
        }

        $document = $this->submissionGateway->updateSubmission(
            $request->bearerToken(),
            $id,
            [
                'status' => Document::STATUS_SUBMITTED,
                'legal_notes' => null,
            ]
        );

        return $this->success(
            'Document resubmitted successfully.',
            $document,
            ['document' => $document]
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
