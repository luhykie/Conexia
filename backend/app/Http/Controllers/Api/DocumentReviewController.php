<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DocumentAnnotation;
use App\Models\DocumentComment;
use App\Models\Profile;
use App\Models\Submission;
use App\Models\SubmissionVersion;
use App\Services\SubmissionWorkflowService;
use App\Services\SupabaseSubmissionGateway;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class DocumentReviewController extends Controller
{
    public function __construct(
        private readonly SubmissionWorkflowService $workflowService,
        private readonly SupabaseSubmissionGateway $submissionGateway,
    ) {
    }

    private function authorizeReviewAccess(Request $request, string $submissionId): Submission
    {
        /** @var Profile $profile */
        $profile = $request->attributes->get('auth_profile');

        $submission = $this->submissionGateway->getSubmission($request->bearerToken(), $submissionId);
        if (! $submission) {
            abort(404, 'Submission not found.');
        }

        $submissionModel = new Submission();
        $submissionModel->forceFill($submission);

        if (! $this->workflowService->canViewFile($profile, $submissionModel)) {
            abort(403, 'Your role is not permitted to access this submission review.');
        }

        return $submissionModel;
    }

    private function currentVersionId(string $submissionId): ?string
    {
        try {
            $version = SubmissionVersion::where('submission_id', $submissionId)
                ->orderByDesc('version_number')
                ->first();

            return $version?->id;
        } catch (QueryException $exception) {
            return null;
        }
    }

    public function index(Request $request, string $submissionId): JsonResponse
    {
        $this->authorizeReviewAccess($request, $submissionId);
        $currentVersionId = $this->currentVersionId($submissionId);

        try {
            $comments = DocumentComment::where('submission_id', $submissionId)
                ->orderBy('created_at')
                ->get();

            $annotations = DocumentAnnotation::where('submission_id', $submissionId)
                ->orderBy('created_at')
                ->get();
        } catch (QueryException $exception) {
            return response()->json([
                'data' => [
                    'comments' => [],
                    'annotations' => [],
                    'current_version_id' => $currentVersionId,
                ],
                'message' => 'Review comments are unavailable. The document preview is still shown.',
            ]);
        }

        return response()->json([
            'data' => [
                'comments' => $comments,
                'annotations' => $annotations,
                'current_version_id' => $currentVersionId,
            ],
        ]);
    }

    public function storeComment(Request $request, string $submissionId): JsonResponse
    {
        $this->authorizeReviewAccess($request, $submissionId);

        /** @var Profile $profile */
        $profile = $request->attributes->get('auth_profile');

        $comment = DocumentComment::create([
            'id' => Str::uuid()->toString(),
            'submission_id' => $submissionId,
            'document_version_id' => $this->currentVersionId($submissionId),
            'user_id' => $profile->id,
            'role_key' => $profile->role_key,
            'page_number' => (int) $request->input('page_number', 1),
            'selected_text' => $request->input('selected_text', ''),
            'highlight_coordinates' => $request->input('highlight_coordinates', null),
            'comment' => $request->input('comment', ''),
            'highlight_color' => $request->input('highlight_color', null),
            'comment_type' => $request->input('comment_type', 'inline'),
            'resolved' => false,
            'created_by_name' => $profile->full_name,
            'role' => $profile->role,
        ]);

        return response()->json([
            'message' => 'Comment created successfully.',
            'data' => $comment,
        ], 201);
    }

    public function updateComment(Request $request, string $submissionId, string $commentId): JsonResponse
    {
        $this->authorizeReviewAccess($request, $submissionId);

        $comment = DocumentComment::where('submission_id', $submissionId)->findOrFail($commentId);
        $comment->fill($request->only(['comment', 'resolved']));
        $comment->save();

        return response()->json([
            'message' => 'Comment updated successfully.',
            'data' => $comment,
        ]);
    }

    public function destroyComment(Request $request, string $submissionId, string $commentId): JsonResponse
    {
        $this->authorizeReviewAccess($request, $submissionId);

        $comment = DocumentComment::where('submission_id', $submissionId)->findOrFail($commentId);
        $comment->delete();

        return response()->json([
            'message' => 'Comment deleted successfully.',
        ]);
    }

    public function storeAnnotation(Request $request, string $submissionId): JsonResponse
    {
        $this->authorizeReviewAccess($request, $submissionId);

        /** @var Profile $profile */
        $profile = $request->attributes->get('auth_profile');

        $annotation = DocumentAnnotation::create([
            'id' => Str::uuid()->toString(),
            'submission_id' => $submissionId,
            'document_version_id' => $this->currentVersionId($submissionId),
            'page_number' => (int) $request->input('page_number', 1),
            'highlight_coordinates' => $request->input('highlight_coordinates', []),
            'color' => $request->input('color', '#f5c542'),
            'created_by' => $profile->id,
            'created_by_name' => $profile->full_name,
            'role' => $profile->role,
        ]);

        return response()->json([
            'message' => 'Annotation created successfully.',
            'data' => $annotation,
        ], 201);
    }

    public function updateAnnotation(Request $request, string $submissionId, string $annotationId): JsonResponse
    {
        $this->authorizeReviewAccess($request, $submissionId);

        $annotation = DocumentAnnotation::where('submission_id', $submissionId)->findOrFail($annotationId);
        $annotation->fill($request->only(['color', 'highlight_coordinates']));
        $annotation->save();

        return response()->json([
            'message' => 'Annotation updated successfully.',
            'data' => $annotation,
        ]);
    }

    public function destroyAnnotation(Request $request, string $submissionId, string $annotationId): JsonResponse
    {
        $this->authorizeReviewAccess($request, $submissionId);

        $annotation = DocumentAnnotation::where('submission_id', $submissionId)->findOrFail($annotationId);
        $annotation->delete();

        return response()->json([
            'message' => 'Annotation deleted successfully.',
        ]);
    }
}
