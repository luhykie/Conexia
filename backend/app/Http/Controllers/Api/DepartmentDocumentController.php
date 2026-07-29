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
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class DepartmentDocumentController extends Controller
{
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
            ->where('department_id', $profile->department_id)
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
            'tracking_number' => ['required', 'string', 'max:100'],
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

        $document = Document::query()->create([
            ...$validated,
            'renewal_status' => $validated['renewal_status'] ??
                ($validated['expiry_date'] ?? null
                    ? Document::RENEWAL_ACTIVE
                    : Document::RENEWAL_NOT_REQUIRED),
            'department_id' => $profile->department_id,
            'submitted_by' => $profile->id,
            'status' => Document::STATUS_SUBMITTED,
        ]);

        return $this->success(
            'Document submitted successfully.',
            DocumentPayload::make($document),
            ['document' => DocumentPayload::make($document)]
        );
    }

    public function resubmit(
        Request $request,
        string $id
    ): JsonResponse {
        $profile = $this->departmentProfile($request);

        $document = DB::transaction(function () use ($id, $profile) {
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

            $document->update([
                'status' => Document::STATUS_SUBMITTED,
                'legal_notes' => null,
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
