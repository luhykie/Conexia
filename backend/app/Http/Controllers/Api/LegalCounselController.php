<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\DecisionRequest;
use App\Http\Requests\NotarizationRequest;
use App\Models\Document;
use App\Models\Profile;
use App\Services\LegalCounselService;
use App\Support\Pagination;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Throwable;

class LegalCounselController extends Controller
{
    public function __construct(
        private readonly LegalCounselService $legalCounsel
    ) {
    }

    public function reviewDocuments(Request $request): JsonResponse
    {
        return $this->run(function () use ($request) {
            $result = $this->legalCounsel
                ->reviewDocuments(
                    $this->profile($request),
                    $this->options($request)
                );
            $documents = $result['items'];

            return $this->success(
                'Review documents loaded successfully.',
                $documents,
                [
                    'documents' => $documents,
                    'meta' => $result['meta'],
                ]
            );
        });
    }

    public function submitDecision(
        DecisionRequest $request,
        string $id
    ): JsonResponse {
        return $this->run(function () use ($request, $id) {
            $document = $this->legalCounsel
                ->submitDecision(
                    $this->profile($request),
                    $id,
                    $request->validated()
                );

            return $this->success(
                'Legal decision saved successfully.',
                $document,
                ['document' => $document]
            );
        });
    }

    public function notarizationDocuments(
        Request $request
    ): JsonResponse {
        return $this->run(function () use ($request) {
            $result = $this->legalCounsel
                ->notarizationDocuments(
                    $this->profile($request),
                    $this->options($request)
                );
            $documents = $result['items'];

            return $this->success(
                'Notarization documents loaded successfully.',
                $documents,
                [
                    'documents' => $documents,
                    'meta' => $result['meta'],
                ]
            );
        });
    }

    public function submitForNotarization(
        NotarizationRequest $request,
        string $id
    ): JsonResponse {
        return $this->run(function () use ($request, $id) {
            $document = $this->legalCounsel
                ->submitForNotarization(
                    $this->profile($request),
                    $id,
                    $request->validated()
                );

            return $this->success(
                'Document submitted for notarization.',
                $document,
                ['document' => $document]
            );
        });
    }

    public function completeNotarization(
        NotarizationRequest $request,
        string $id
    ): JsonResponse {
        return $this->run(function () use ($request, $id) {
            $document = $this->legalCounsel
                ->completeNotarization(
                    $this->profile($request),
                    $id,
                    $request->validated()
                );

            return $this->success(
                'Document notarization completed.',
                $document,
                ['document' => $document]
            );
        });
    }

    public function history(Request $request): JsonResponse
    {
        return $this->run(function () use ($request) {
            $result = $this->legalCounsel
                ->history(
                    $this->profile($request),
                    $this->options($request)
                );
            $history = $result['items'];

            return $this->success(
                'Legal history loaded successfully.',
                $history,
                [
                    'history' => $history,
                    'meta' => $result['meta'],
                ]
            );
        });
    }

    private function options(Request $request): array
    {
        return Pagination::options(
            $request,
            ['updated_at', 'submitted_at', 'tracking_number', 'status'],
            'updated_at',
            Document::workflowStatuses()
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

    private function run(callable $action): JsonResponse
    {
        try {
            return $action();
        } catch (ValidationException $exception) {
            return response()->json([
                'success' => false,
                'message' => 'The requested workflow action is invalid.',
                'errors' => $exception->errors(),
            ], 422);
        } catch (ModelNotFoundException) {
            return response()->json([
                'success' => false,
                'message' => 'The requested document could not be found.',
                'errors' => [],
            ], 404);
        } catch (Throwable $exception) {
            Log::error(
                'Legal Counsel API request failed.',
                ['exception' => $exception]
            );

            return response()->json([
                'success' => false,
                'message' => 'An unexpected server error occurred.',
                'errors' => [],
            ], 500);
        }
    }
}
