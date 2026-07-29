<?php

namespace App\Http\Middleware;

use App\Models\Profile;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserManagementAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        $actor = $request->attributes->get(
            'authenticated_profile'
        );

        if (!$actor) {
            return $this->error(
                'Authentication is required.',
                401
            );
        }

        if ($actor->role === Profile::ROLE_SUPER_ADMIN) {
            return $next($request);
        }

        $target = $request->route('profile');

        if (
            $target instanceof Profile &&
            $target->role === Profile::ROLE_SUPER_ADMIN
        ) {
            return $this->error(
                'Only Super Admin may manage Super Admin accounts.',
                403
            );
        }

        if (
            $request->input('role') ===
            Profile::ROLE_SUPER_ADMIN
        ) {
            return $this->error(
                'Only Super Admin may assign the Super Admin role.',
                403
            );
        }

        return $next($request);
    }

    private function error(
        string $message,
        int $status
    ): JsonResponse {
        return response()->json([
            'success' => false,
            'message' => $message,
            'errors' => [],
        ], $status);
    }
}
