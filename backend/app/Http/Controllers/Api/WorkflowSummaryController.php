<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Models\Profile;
use App\Services\WorkflowSummaryService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
                $this->options($request, ['expiry_date', 'updated_at', 'tracking_number'])
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
        return Pagination::options(
            $request,
            $sortColumns,
            $sortColumns[0] ?? 'updated_at',
            Document::workflowStatuses()
        );
    }
}
