<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRole
{
    public function handle(
        Request $request,
        Closure $next,
        string ...$roles
    ): Response {
        $profile = $request->attributes->get(
            'authenticated_profile'
        );

        if (!$profile) {
            return $this->error(
                'Authentication is required.',
                401
            );
        }

        if (!in_array($profile->role, $roles, true)) {
            return $this->error(
                'You do not have permission to access this endpoint.',
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
