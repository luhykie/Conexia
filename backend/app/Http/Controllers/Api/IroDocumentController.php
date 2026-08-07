<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Models\Profile;
use App\Support\DocumentPayload;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class IroDocumentController extends Controller
{
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
            return DocumentPayload::make($document);
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
        return $this->success(
            $message,
            DocumentPayload::make($document),
            ['document' => DocumentPayload::make($document)]
        );
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
