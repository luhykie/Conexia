<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSubmissionRequest;
use App\Http\Requests\UpdateSubmissionRequest;
use App\Http\Requests\UpdateSubmissionStatusRequest;
use App\Models\Profile;
use App\Models\SubmissionVersion;
use App\Models\Submission;
use App\Services\SubmissionWorkflowService;
use App\Services\SupabaseSubmissionGateway;
use App\Services\SupabaseStorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Client\RequestException;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

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

        $query = [];

        if ($profile->role_key === 'department') {
            $query['submitted_by'] = 'eq.'.$profile->id;
        }

        if ($request->filled('status')) {
            $query['status'] = (string) $request->query('status');
        }

        $rows = $this->submissionGateway->listSubmissions(
            $request->bearerToken(),
            $query
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
        return $this->downloadDocument($request, $submissionId);
    }

    public function downloadDocument(Request $request, string $submissionId): JsonResponse
    {
        /** @var Profile $profile */
        $profile = $request->attributes->get('auth_profile');

        Log::info('Submission document request received', [
            'submission_id' => $submissionId,
            'user_id' => $profile->id ?? null,
            'role_key' => $profile->role_key ?? null,
        ]);

        $submission = $this->submissionGateway->getSubmission($request->bearerToken(), $submissionId);

        if (! $submission) {
            Log::warning('Submission document request failed: submission not found', [
                'submission_id' => $submissionId,
                'user_id' => $profile->id ?? null,
            ]);
            abort(404, 'Submission not found.');
        }

        $submissionModel = new Submission();
        $submissionModel->forceFill($submission);

        if (! $this->workflowService->canViewFile($profile, $submissionModel)) {
            Log::warning('Submission document request denied', [
                'submission_id' => $submissionId,
                'user_id' => $profile->id ?? null,
                'role_key' => $profile->role_key ?? null,
            ]);
            abort(403, 'Your role is not permitted to view the attached file.');
        }

        $attachmentPath = $submission['storage_path'] ?? null;
        if (! $attachmentPath && isset($submission['attachments'][0]['storage_path'])) {
            $attachmentPath = $submission['attachments'][0]['storage_path'];
        }
        if (! $attachmentPath && isset($submission['versions'][0]['storage_path'])) {
            $attachmentPath = $submission['versions'][0]['storage_path'];
        }

        if (empty($attachmentPath)) {
            Log::warning('Submission document request failed: missing attachment path', [
                'submission_id' => $submissionId,
                'user_id' => $profile->id ?? null,
            ]);
            abort(404, 'No file has been attached to this submission yet.');
        }

        if (str_starts_with((string) $attachmentPath, 'data:')) {
            Log::info('Submission document request served from inline data URI', [
                'submission_id' => $submissionId,
            ]);
            return response()->json([
                'data' => [
                    'url' => $attachmentPath,
                    'file_name' => $submission['file_name'] ?? null,
                    'expires_in' => null,
                ],
            ]);
        }

        Log::info('Submission document response issued', [
            'submission_id' => $submissionId,
            'storage_disk' => Storage::disk('local')->exists($attachmentPath) ? 'local' : 'supabase',
            'attachment_path' => $attachmentPath,
        ]);

        return response()->json([
            'data' => [
                'url' => '/api/submissions/'.$submissionId.'/file/download',
                'file_name' => $submission['file_name'] ?? null,
                'expires_in' => null,
            ],
        ]);
    }

    public function downloadFileRaw(Request $request, string $submissionId)
    {
        /** @var Profile $profile */
        $profile = $request->attributes->get('auth_profile');

        Log::info('Submission document stream requested', [
            'submission_id' => $submissionId,
            'user_id' => $profile->id ?? null,
            'role_key' => $profile->role_key ?? null,
        ]);

        $submission = $this->submissionGateway->getSubmission($request->bearerToken(), $submissionId);
        if (! $submission) {
            abort(404, 'Submission not found.');
        }

        $submissionModel = new Submission();
        $submissionModel->forceFill($submission);

        if (! $this->workflowService->canViewFile($profile, $submissionModel)) {
            Log::warning('Submission document stream denied', [
                'submission_id' => $submissionId,
                'user_id' => $profile->id ?? null,
                'role_key' => $profile->role_key ?? null,
            ]);
            abort(403, 'Your role is not permitted to view the attached file.');
        }

        $attachmentPath = $submission['storage_path'] ?? null;
        if (! $attachmentPath && isset($submission['attachments'][0]['storage_path'])) {
            $attachmentPath = $submission['attachments'][0]['storage_path'];
        }
        if (! $attachmentPath && isset($submission['versions'][0]['storage_path'])) {
            $attachmentPath = $submission['versions'][0]['storage_path'];
        }

        if (empty($attachmentPath)) {
            Log::warning('Submission document stream failed: missing attachment path', [
                'submission_id' => $submissionId,
                'user_id' => $profile->id ?? null,
            ]);
            abort(404, 'No file has been attached to this submission yet.');
        }

        if (Storage::disk('local')->exists($attachmentPath)) {
            $fileName = $submission['file_name'] ?? basename($attachmentPath);
            $absolutePath = Storage::disk('local')->path($attachmentPath);
            $mimeType = mime_content_type($absolutePath) ?: 'application/pdf';

            Log::info('Submission document streamed from local storage', [
                'submission_id' => $submissionId,
                'attachment_path' => $attachmentPath,
            ]);

            return response()->file($absolutePath, [
                'Content-Type' => str_contains($mimeType, 'pdf') ? 'application/pdf' : $mimeType,
                'Content-Disposition' => 'inline; filename="'.addslashes($fileName).'"',
            ]);
        }

        try {
            $signedUrl = $this->storageService->signedUrl($attachmentPath);
            Log::info('Submission document streamed from Supabase storage', [
                'submission_id' => $submissionId,
                'attachment_path' => $attachmentPath,
            ]);
            $response = Http::get($signedUrl);

            if ($response->failed()) {
                Log::error('Submission document stream failed from Supabase storage', [
                    'submission_id' => $submissionId,
                    'attachment_path' => $attachmentPath,
                    'status' => $response->status(),
                ]);
                abort($response->status(), 'Unable to stream the attached file from storage.');
            }

            return response($response->body(), 200)
                ->header('Content-Type', $response->header('Content-Type', 'application/pdf'))
                ->header('Content-Disposition', 'inline; filename="'.($submission['file_name'] ?? basename($attachmentPath)).'"');
        } catch (RequestException $exception) {
            Log::error('Submission document stream request exception', [
                'submission_id' => $submissionId,
                'attachment_path' => $attachmentPath,
                'message' => $exception->getMessage(),
            ]);
            abort(502, 'Unable to stream the attached file from storage.');
        } catch (\Throwable $exception) {
            Log::error('Submission document stream unexpected failure', [
                'submission_id' => $submissionId,
                'attachment_path' => $attachmentPath,
                'message' => $exception->getMessage(),
            ]);
            abort(502, 'Unable to stream the attached file from storage.');
        }
    }

    public function uploadAttachment(Request $request, string $submissionId): JsonResponse
    {
        /** @var Profile $profile */
        $profile = $request->attributes->get('auth_profile');

        $submission = $this->submissionGateway->getSubmission($request->bearerToken(), $submissionId);
        if (! $submission) {
            abort(404, 'Submission not found.');
        }

        if (($submission['submitted_by'] ?? null) !== $profile->id && $profile->role_key !== 'super_admin') {
            abort(403, 'You are not allowed to attach files to this submission.');
        }

        $request->validate([
            'attachment' => ['required', 'file', 'max:25600'],
        ]);

        $file = $request->file('attachment');
        if (! $file) {
            abort(400, 'No file was uploaded.');
        }

        $fileName = $file->getClientOriginalName();
        $storagePath = Storage::disk('local')->putFileAs("submissions/{$submissionId}", $file, $fileName);
        if (! $storagePath) {
            abort(500, 'Unable to save the uploaded file.');
        }

        $currentVersion = (int) ($submission['version'] ?? 0);
        $nextVersion = $currentVersion + 1;

        try {
            $currentVersion = (int) (SubmissionVersion::where('submission_id', $submissionId)->max('version_number') ?: $currentVersion);
            $nextVersion = $currentVersion + 1;

            SubmissionVersion::create([
                'submission_id' => $submissionId,
                'version_number' => $nextVersion,
                'storage_path' => $storagePath,
                'file_name' => $fileName,
                'uploaded_by' => $profile->id,
                'upload_reason' => $currentVersion > 0 ? 'revision_upload' : 'original_draft',
                'notes' => $currentVersion > 0 ? 'Uploaded as a new document version.' : 'Initial document upload.',
            ]);
        } catch (QueryException $exception) {
            Log::warning('Submission version table unavailable; falling back to submission version field.', [
                'submission_id' => $submissionId,
                'message' => $exception->getMessage(),
            ]);
        }

        $updated = $this->submissionGateway->updateSubmission($request->bearerToken(), $submissionId, [
            'storage_path' => $storagePath,
            'file_name' => $fileName,
            'version' => $nextVersion,
        ]);

        return response()->json([
            'message' => 'Attachment uploaded successfully.',
            'data' => $updated,
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
