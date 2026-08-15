<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Models\Profile;
use App\Services\WorkflowSummaryService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class WorkflowSummaryController extends Controller
{
    public function __construct(
        private readonly WorkflowSummaryService $summaries
    ) {
    }

    public function expiry(Request $request): JsonResponse
    {
        return $this->success(
            'Expiry records loaded successfully.',
            $this->summaries->expiry(
                $this->profile($request),
                $this->expiryOptions($request)
            )
        );
    }

    public function requestRenewal(
        Request $request,
        string $id
    ): JsonResponse {
        $record = $this->summaries->requestRenewal(
            $this->profile($request),
            $id
        );

        return $this->success(
            'Renewal request recorded successfully.',
            $record
        );
    }

    public function archive(Request $request): JsonResponse
    {
        $data = $this->summaries->archive(
            $this->options($request, ['archived_at', 'tracking_number', 'status'])
        );

        return $this->success(
            'Archive records loaded successfully.',
            $data
        );
    }

    public function reports(Request $request): JsonResponse
    {
        $data = $this->summaries->reports(
            $this->options($request, ['updated_at', 'tracking_number', 'status'])
        );

        return $this->success(
            'Report summary loaded successfully.',
            $data
        );
    }

    private function profile(Request $request): Profile
    {
        return $request->attributes->get(
            'authenticated_profile'
        );
    }

    private function success(
        string $message,
        array $data
    ): JsonResponse {
        $meta = $data['meta'] ?? null;
        unset($data['meta']);

        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $data,
            ...($meta ? ['meta' => $meta] : []),
        ]);
    }

    private function options(
        Request $request,
        array $sortColumns
    ): array {
        $options = Pagination::options(
            $request,
            $sortColumns,
            $sortColumns[0] ?? 'updated_at',
            Document::workflowStatuses()
        );

        $extra = $request->validate([
            'document_type' => ['nullable', 'string', 'max:100'],
            'department' => ['nullable', 'string', 'max:100'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'partnership_scope' => ['nullable', 'string', 'max:100'],
        ]);

        return [
            ...$options,
            'document_type' => $extra['document_type'] ?? null,
            'department' => $extra['department'] ?? null,
            'date_from' => $extra['date_from'] ?? null,
            'date_to' => $extra['date_to'] ?? null,
            'partnership_scope' => $extra['partnership_scope'] ?? null,
        ];
    }

    private function expiryOptions(Request $request): array
    {
        $options = Pagination::options(
            $request,
            ['expiry_date', 'updated_at', 'tracking_number'],
            'expiry_date'
        );

        $extra = $request->validate([
            'status' => [
                'nullable',
                Rule::in(['Active', 'Renewal Required', 'Renewed', 'Expired']),
            ],
            'expiry_window' => [
                'nullable',
                Rule::in(['120', '90', '60', '30', 'expired']),
            ],
            'document_type' => ['nullable', Rule::in(['MOA', 'MOU', 'MOF'])],
            'department' => ['nullable', 'string', 'max:100'],
            'partnership_scope' => [
                'nullable',
                Rule::in(['Departmental', 'Local', 'International']),
            ],
        ]);

        return [
            ...$options,
            'status' => null,
            'renewal_filter' => $extra['status'] ?? null,
            'expiry_window' => $extra['expiry_window'] ?? null,
            'document_type' => $extra['document_type'] ?? null,
            'department' => $extra['department'] ?? null,
            'partnership_scope' => $extra['partnership_scope'] ?? null,
        ];
    }
}
