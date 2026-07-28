<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSubmissionRequest;
use App\Http\Requests\UpdateSubmissionRequest;
use App\Http\Requests\UpdateSubmissionStatusRequest;
use App\Models\Profile;
use App\Models\Submission;
use App\Services\SubmissionWorkflowService;
use App\Services\SupabaseSubmissionGateway;
use App\Services\SupabaseStorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SubmissionController extends Controller
{
    public function __construct(
        private readonly SubmissionWorkflowService $workflowService,
        private readonly SupabaseStorageService $storageService,
        private readonly SupabaseSubmissionGateway $submissionGateway,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        /** @var Profile $profile */
        $profile = $request->attributes->get('auth_profile');

        $rows = $this->submissionGateway->listSubmissions(
            $request->bearerToken(),
            $profile->role_key === 'department'
                ? ['submitted_by' => 'eq.'.$profile->id]
                : []
        );

        return response()->json([
            'data' => $rows,
        ]);
    }

    public function store(StoreSubmissionRequest $request): JsonResponse
    {
        /** @var Profile $profile */
        $profile = $request->attributes->get('auth_profile');

        $payload = $request->validated();
        $payload['submitted_by'] = $profile->id;
        $payload['created_by'] = $profile->id;
        $payload['department_id'] = $profile->department;
        $payload['tracking_number'] = $this->submissionGateway->nextTrackingNumber($profile->tracking_prefix ?? 'SCS');
        $payload['office'] = $profile->office;
        $payload['department'] = $profile->department;
        $isDraft = $request->boolean('draft');
        $payload['status'] = $isDraft ? 'draft' : 'pending_iro_staff_review';
        $payload['current_stage'] = $isDraft ? 'draft' : 'iro_staff';
        $payload['version'] = 1;
        $payload['revision_cycle'] = 1;
        $payload['submitted_at'] = now()->toIso8601String();

        $submission = $this->submissionGateway->createSubmission($request->bearerToken(), $payload);

        return response()->json([
            'message' => $isDraft
                ? 'Draft submission created successfully.'
                : 'Submission sent for review and routed to IRO Staff.',
            'data' => $submission,
        ], 201);
    }

    public function update(UpdateSubmissionRequest $request, string $submissionId): JsonResponse
    {
        /** @var Profile $profile */
        $profile = $request->attributes->get('auth_profile');

        $submission = $this->submissionGateway->getSubmission($request->bearerToken(), $submissionId);
        if (! $submission) {
            abort(404, 'Submission not found.');
        }

        if (($submission['submitted_by'] ?? null) !== $profile->id && $profile->role_key !== 'super_admin') {
            abort(403, 'You are not allowed to update this submission.');
        }

        $payload = array_filter($request->validated(), fn ($value) => $value !== null);
        $payload['updated_at'] = now()->toIso8601String();

        $updated = $this->submissionGateway->updateSubmission($request->bearerToken(), $submissionId, $payload);

        return response()->json([
            'message' => 'Draft updated successfully.',
            'data' => $updated,
        ]);
    }

    public function show(Request $request, string $submissionId): JsonResponse
    {
        return response()->json([
            'data' => $this->submissionGateway->getSubmission($request->bearerToken(), $submissionId),
        ]);
    }

    /**
     * Issue a short-lived signed URL to the attached file — gated by role here,
     * server-side, rather than trusting the frontend to hide the link.
     * IRO Staff is deliberately excluded; see SubmissionWorkflowService::canViewFile().
     */
    public function downloadFile(Request $request, string $submissionId): JsonResponse
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
            abort(403, 'Your role is not permitted to view the attached file.');
        }

        if (empty($submission['storage_path'])) {
            abort(404, 'No file has been attached to this submission yet.');
        }

        $signedUrl = $this->storageService->signedUrl($submission['storage_path']);

        return response()->json([
            'data' => [
                'url' => $signedUrl,
                'file_name' => $submission['file_name'] ?? null,
                'expires_in' => 300,
            ],
        ]);
    }

    public function updateStatus(UpdateSubmissionStatusRequest $request, string $submissionId): JsonResponse
    {
        /** @var Profile $profile */
        $profile = $request->attributes->get('auth_profile');

        $updated = $this->submissionGateway->updateSubmission(
            $request->bearerToken(),
            $submissionId,
            array_filter([
                'status' => $request->validated('status'),
                'notes' => $request->validated('notes'),
                'metadata' => $request->validated('metadata', []),
            ], fn ($value) => $value !== null),
        );

        return response()->json([
            'message' => 'Submission status updated.',
            'data' => $updated,
        ]);
    }

    public function generateReviewForm(Request $request, string $submissionId): JsonResponse
    {
        $updated = $this->submissionGateway->updateSubmission(
            $request->bearerToken(),
            $submissionId,
            ['status' => 'pending_iro_admin_review'],
        );

        return response()->json([
            'message' => 'Review Form generated successfully.',
            'data' => $updated,
        ], 201);
    }

    public function generateNotarizationForm(Request $request, string $submissionId): JsonResponse
    {
        $updated = $this->submissionGateway->updateSubmission(
            $request->bearerToken(),
            $submissionId,
            ['status' => 'pending_notarization'],
        );

        return response()->json([
            'message' => 'Notarization Form generated successfully.',
            'data' => $updated,
        ], 201);
    }

    public function recordNotarization(Request $request, string $submissionId): JsonResponse
    {
        $updated = $this->submissionGateway->updateSubmission(
            $request->bearerToken(),
            $submissionId,
            ['status' => 'notarized'],
        );

        return response()->json([
            'message' => 'Notarization recorded successfully.',
            'data' => $updated,
        ]);
    }

    public function archiveSubmission(Request $request, string $submissionId): JsonResponse
    {
        $updated = $this->submissionGateway->updateSubmission(
            $request->bearerToken(),
            $submissionId,
            ['status' => 'archived'],
        );

        return response()->json([
            'message' => 'Submission archived successfully.',
            'data' => $updated,
        ]);
    }

    public function distributeSubmission(Request $request, string $submissionId): JsonResponse
    {
        $updated = $this->submissionGateway->updateSubmission(
            $request->bearerToken(),
            $submissionId,
            ['status' => 'distributed'],
        );

        return response()->json([
            'message' => 'Submission distributed successfully.',
            'data' => $updated,
        ]);
    }
}
