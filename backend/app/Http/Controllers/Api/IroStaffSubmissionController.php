<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class IroStaffSubmissionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = [
            'select' => '*', 'order' => 'created_at.desc', 'limit' => 100,
        ];
        if (is_string($request->query('status')) && $request->query('status') !== '') {
            $query['status'] = 'eq.'.$request->query('status');
        }
        $response = $this->client($request)->get('/rest/v1/submissions', $query);

        if (! $response->successful()) {
            return $this->errorResponse($response, 'Unable to load submissions.');
        }

        return response()->json(['data' => array_map(
            fn (array $row): array => $this->normalizeSubmission($row),
            $response->json() ?? []
        )]);
    }

    public function dashboard(Request $request): JsonResponse
    {
        $submissionsResponse = $this->client($request)->get('/rest/v1/submissions', [
            'select' => '*', 'order' => 'created_at.desc', 'limit' => 100,
        ]);
        $eventsResponse = $this->client($request)->get('/rest/v1/workflow_events', [
            'select' => '*', 'order' => 'created_at.desc', 'limit' => 10,
        ]);

        if (! $submissionsResponse->successful()) {
            return $this->errorResponse($submissionsResponse, 'Unable to load dashboard submissions.');
        }
        if (! $eventsResponse->successful()) {
            return $this->errorResponse($eventsResponse, 'Unable to load dashboard activity.');
        }

        $profile = $request->attributes->get('auth_profile');
        $today = now()->toDateString();
        $rows = array_map(
            fn (array $row): array => $this->normalizeSubmission($row),
            $submissionsResponse->json() ?? []
        );
        $queue = array_values(array_filter(
            $rows,
            fn (array $row): bool => ($row['status_key'] ?? null) === 'submitted'
        ));
        usort($queue, fn (array $a, array $b): int => strcmp(
            (string) ($a['created_at'] ?? ''),
            (string) ($b['created_at'] ?? '')
        ));

        return response()->json(['data' => [
            'stats' => [
                'incoming' => count($queue),
                'loggedToday' => count(array_filter($rows, fn (array $row): bool =>
                    str_starts_with((string) ($row['logged_at'] ?? ''), $today)
                )),
                'awaitingCheck' => count(array_filter($rows, fn (array $row): bool =>
                    ($row['status_key'] ?? null) === 'logged'
                )),
                'routedToLegal' => count(array_filter($rows, fn (array $row): bool =>
                    ($row['current_stage'] ?? null) === 'legal'
                )),
            ],
            'queue' => array_slice($queue, 0, 5),
            'assignedQueue' => array_values(array_filter($rows, fn (array $row): bool =>
                ($row['assigned_iro_staff'] ?? null) === ($profile->id ?? null)
                && ($row['current_stage'] ?? null) === 'iro_staff'
            )),
            'activities' => array_map(fn (array $event): array => $event + [
                'event_type' => $event['action'] ?? '',
            ], $eventsResponse->json() ?? []),
        ]]);
    }

    public function show(Request $request, string $submissionId): JsonResponse
    {
        $response = $this->client($request)->get('/rest/v1/submissions', [
            'select' => '*', 'id' => 'eq.'.$submissionId, 'limit' => 1,
        ]);

        if (! $response->successful()) {
            return $this->errorResponse($response, 'Unable to load the submission.');
        }

        $submission = ($response->json() ?? [])[0] ?? null;
        if (! is_array($submission)) {
            return response()->json(['message' => 'Submission not found.'], 404);
        }

        return response()->json(['data' => $this->normalizeSubmission($submission)]);
    }

    public function log(Request $request, string $submissionId): JsonResponse
    {
        $response = $this->client($request)->post(
            '/rest/v1/rpc/log_incoming_submission',
            ['p_submission_id' => $submissionId]
        );

        if (! $response->successful()) {
            return $this->errorResponse($response, 'Unable to log the submission.');
        }

        return response()->json([
            'message' => 'Submission logged successfully.',
            'data' => $this->normalizeSubmission($response->json() ?? []),
        ]);
    }

    public function reviewForm(Request $request, string $submissionId): JsonResponse
    {
        $response = $this->client($request)->get('/rest/v1/review_forms', [
            'select' => '*', 'submission_id' => 'eq.'.$submissionId,
            'order' => 'created_at.desc', 'limit' => 1,
        ]);

        if (! $response->successful()) {
            return $this->errorResponse($response, 'Unable to load the Review Form.');
        }

        $form = ($response->json() ?? [])[0] ?? null;

        return response()->json([
            'data' => is_array($form) ? $this->normalizeReviewForm($form) : null,
        ]);
    }

    public function saveReviewForm(Request $request, string $submissionId): JsonResponse
    {
        return $this->persistReviewForm($request, $submissionId, false);
    }

    public function submitReviewForm(Request $request, string $submissionId): JsonResponse
    {
        return $this->persistReviewForm($request, $submissionId, true);
    }

    private function persistReviewForm(Request $request, string $submissionId, bool $complete): JsonResponse
    {
        $validated = $request->validate([
            'checklist_answers' => ['nullable', 'array'],
            'staff_remarks' => ['nullable', 'string', 'max:5000'],
        ]);

        $response = $this->client($request)->post('/rest/v1/rpc/save_iro_review_form', [
            'p_submission_id' => $submissionId,
            'p_form_data' => $validated,
            'p_complete' => $complete,
        ]);

        if (! $response->successful()) {
            return $this->errorResponse(
                $response,
                $complete ? 'Unable to submit the Review Form to IRO Admin.' : 'Unable to save the Review Form draft.'
            );
        }

        return response()->json([
            'message' => $complete ? 'Review Form submitted to IRO Admin.' : 'Review Form draft saved.',
            'data' => $this->normalizeReviewForm($response->json() ?? []),
        ]);
    }

    private function client(Request $request): PendingRequest
    {
        $url = rtrim((string) config('services.supabase.url'), '/');
        $anonKey = (string) config('services.supabase.anon_key');
        abort_if($url === '' || $anonKey === '', 500, 'Supabase API is not configured.');

        return Http::baseUrl($url)->acceptJson()
            ->withHeaders(['apikey' => $anonKey])
            ->withToken((string) $request->bearerToken())->timeout(20);
    }

    private function normalizeSubmission(array $submission): array
    {
        $statusKey = (string) ($submission['status'] ?? '');
        $displayStatus = match ($statusKey) {
            'submitted' => 'Submitted',
            'logged' => 'Logged',
            'review_form_generated' => ($submission['current_stage'] ?? null) === 'legal'
                ? 'Under Legal Review'
                : 'Review Form Submitted',
            'resubmitted' => 'Revised and Resubmitted',
            'corrections_needed' => 'Corrections Needed',
            'approved' => 'Approved',
            'pending_notarization' => 'Pending Notarization',
            'notarized' => 'Notarized',
            'distributed' => 'Distribution Complete',
            'archived' => 'Archived',
            default => $statusKey,
        };

        return array_merge($submission, [
            'status_key' => $statusKey,
            'status' => $displayStatus,
            'title' => $submission['agreement_title'] ?? $submission['agreement_type'] ?? '',
            'document_type' => $submission['agreement_type'] ?? '',
            'partner_institution' => $submission['partner_institution_name'] ?? '',
            'submitted_at' => $submission['created_at'] ?? null,
            'departments' => ['name' => $submission['department'] ?? $submission['office'] ?? ''],
        ]);
    }

    private function normalizeReviewForm(array $form): array
    {
        $formData = is_array($form['form_data'] ?? null) ? $form['form_data'] : [];

        return $formData + $form + [
            'review_form_status' => empty($form['completed_at']) ? 'draft' : 'submitted',
        ];
    }

    private function errorResponse($response, string $fallback): JsonResponse
    {
        return response()->json([
            'message' => $response->json('message') ?: $fallback,
        ], $response->status() >= 500 ? 502 : ($response->status() === 404 ? 404 : 422));
    }
}
