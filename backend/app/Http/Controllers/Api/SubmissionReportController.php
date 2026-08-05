<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class SubmissionReportController extends Controller
{
    public function reviewTurnaround(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $supabaseUrl = rtrim((string) config('services.supabase.url'), '/');
        $anonKey = (string) config('services.supabase.anon_key');

        if ($supabaseUrl === '' || $anonKey === '') {
            return response()->json(['message' => 'Supabase API is not configured.'], 500);
        }

        $from = isset($validated['from'])
            ? CarbonImmutable::parse($validated['from'])->startOfDay()->toIso8601String()
            : null;
        $to = isset($validated['to'])
            ? CarbonImmutable::parse($validated['to'])->endOfDay()->toIso8601String()
            : null;

        $response = Http::acceptJson()
            ->withHeaders(['apikey' => $anonKey])
            ->withToken((string) $request->bearerToken())
            ->timeout(20)
            ->post("{$supabaseUrl}/rest/v1/rpc/get_review_turnaround_report", [
                'p_from' => $from,
                'p_to' => $to,
            ]);

        if (! $response->successful()) {
            return response()->json([
                'message' => $response->json('message')
                    ?: 'Unable to generate the review-turnaround report.',
            ], $response->status() >= 500 ? 502 : 422);
        }

        return response()->json(['data' => $response->json()]);
    }
}
