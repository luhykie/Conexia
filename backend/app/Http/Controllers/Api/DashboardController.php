<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Profile;
use App\Services\DashboardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __construct(
        private readonly DashboardService $dashboards
    ) {
    }

    public function department(Request $request): JsonResponse
    {
        return $this->success(
            'Department dashboard loaded successfully.',
            $this->dashboards->department($this->profile($request))
        );
    }

    public function iro(Request $request): JsonResponse
    {
        return $this->success(
            'IRO dashboard loaded successfully.',
            $this->dashboards->iro($this->profile($request))
        );
    }

    public function legal(Request $request): JsonResponse
    {
        return $this->success(
            'Legal dashboard loaded successfully.',
            $this->dashboards->legal($this->profile($request))
        );
    }

    public function superAdmin(): JsonResponse
    {
        return $this->success(
            'Super Admin dashboard loaded successfully.',
            $this->dashboards->superAdmin()
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
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $data,
            'dashboard' => $data,
        ]);
    }
}
