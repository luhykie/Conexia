<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class HealthController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json([
            'status' => 'ok',
            'service' => 'conexia-api',
            'timestamp' => now()->toIso8601String(),
        ]);
    }
}
