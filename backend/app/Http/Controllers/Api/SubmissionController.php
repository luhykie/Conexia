<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreSubmissionRequest;
use App\Http\Requests\UpdateSubmissionStatusRequest;
use App\Models\Profile;
use App\Models\Submission;
use App\Services\SubmissionWorkflowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SubmissionController extends Controller
{
    public function __construct(private readonly SubmissionWorkflowService $workflowService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        /** @var Profile $profile */
        $profile = $request->attributes->get('auth_profile');

        $query = Submission::query()->with(['versions', 'workflowEvents'])->orderByDesc('created_at');

        if ($profile->role_key === 'department') {
            $query->where('submitted_by', $profile->id);
        } elseif ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        return response()->json([
            'data' => $query->limit(100)->get(),
        ]);
    }

    public function store(StoreSubmissionRequest $request): JsonResponse
    {
        /** @var Profile $profile */
        $profile = $request->attributes->get('auth_profile');

        $submission = $this->workflowService->createSubmission(
            $profile,
            $request->validated(),
        );

        return response()->json([
            'message' => 'Submission sent for review and routed to IRO Staff.',
            'data' => $submission,
        ], 201);
    }

    public function show(Request $request, Submission $submission): JsonResponse
    {
        /** @var Profile $profile */
        $profile = $request->attributes->get('auth_profile');

        if ($profile->role_key === 'department' && $submission->submitted_by !== $profile->id) {
            abort(403, 'You can only view your own submissions.');
        }

        return response()->json([
            'data' => $submission->load(['versions', 'workflowEvents']),
        ]);
    }

    public function updateStatus(UpdateSubmissionStatusRequest $request, Submission $submission): JsonResponse
    {
        /** @var Profile $profile */
        $profile = $request->attributes->get('auth_profile');

        $updated = $this->workflowService->updateStatus(
            $profile,
            $submission,
            $request->validated('status'),
            $request->validated('notes'),
            $request->validated('metadata', []),
        );

        return response()->json([
            'message' => 'Submission status updated.',
            'data' => $updated,
        ]);
    }
}
