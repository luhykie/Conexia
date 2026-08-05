<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class SubmissionRoutingController extends Controller
{
    public function routeToLegal(Request $request, string $submissionId): JsonResponse
    {
        $validated = $request->validate([
            'legal_counsel_id' => ['required', 'uuid'],
        ]);

        $supabaseUrl = rtrim((string) config('services.supabase.url'), '/');
        $anonKey = (string) config('services.supabase.anon_key');

        if ($supabaseUrl === '' || $anonKey === '') {
            return response()->json([
                'message' => 'Supabase API is not configured.',
            ], 500);
        }

        $response = Http::acceptJson()
            ->withHeaders(['apikey' => $anonKey])
            ->withToken((string) $request->bearerToken())
            ->timeout(15)
            ->post("{$supabaseUrl}/rest/v1/rpc/route_submission_to_legal", [
                'p_submission_id' => $submissionId,
                'p_legal_counsel_id' => $validated['legal_counsel_id'],
            ]);

        if (! $response->successful()) {
            return response()->json([
                'message' => $response->json('message')
                    ?: 'Unable to route the submission to Legal Counsel.',
            ], $response->status() >= 500 ? 502 : 422);
        }

        return response()->json([
            'message' => 'Review Form validated and submission routed to Legal Counsel.',
            'data' => [
                'submission_id' => $submissionId,
                'legal_counsel_id' => $validated['legal_counsel_id'],
                'current_stage' => 'legal',
                'status' => 'review_form_generated',
            ],
        ]);
    }
}
