<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Profile;
use App\Services\DashboardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    // Receives the service responsible for calculating dashboard data.
    public function __construct(
        private readonly DashboardService $dashboards
    ) {
    }

    // Returns dashboard statistics scoped to the authenticated department.
    public function department(Request $request): JsonResponse
    {
        return $this->success(
            'Department dashboard loaded successfully.',
            $this->dashboards->department($this->profile($request))
        );
    }

    // Returns the IRO Admin dashboard for the authenticated profile.
    public function iro(Request $request): JsonResponse
    {
        return $this->success(
            'IRO dashboard loaded successfully.',
            $this->dashboards->iro($this->profile($request))
        );
    }

    // Returns dashboard statistics for the authenticated Legal Counsel.
    public function legal(Request $request): JsonResponse
    {
        return $this->success(
            'Legal dashboard loaded successfully.',
            $this->dashboards->legal($this->profile($request))
        );
    }

    // Returns system-wide dashboard statistics for Super Admin.
    public function superAdmin(): JsonResponse
    {
        return $this->success(
            'Super Admin dashboard loaded successfully.',
            $this->dashboards->superAdmin()
        );
    }

    // Retrieves the authenticated profile attached by auth middleware.
    private function profile(Request $request): Profile
    {
        return $request->attributes->get(
            'authenticated_profile'
        );
    }

    // Produces the common successful dashboard response structure.
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
