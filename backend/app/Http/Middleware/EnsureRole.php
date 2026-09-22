<?php
// Role guard: siguroa nga naay valid profile una i-check ang allowed roles.

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRole
{
    // I-check ang profile role ug tugoti lang ang requested access set.
    public function handle(
        Request $request,
        Closure $next,
        string ...$roles
    ): Response {
        $profile = $request->attributes->get(
            'authenticated_profile'
        );

        if (!$profile) {
            // Kinahanglan og tinuod nga profile ang route guards una sa RBAC comparison.
            return $this->error(
                'Authentication is required.',
                401
            );
        }

        if (!in_array($profile->role, $roles, true)) {
            // Naka-lock ni nga route sa piho nga role set, mao nga blocked ang uban.
            return $this->error(
                'You do not have permission to access this endpoint.',
                403
            );
        }

        return $next($request);
    }

    // Himoa ang JSON payload para sa denied o kulang nga access.
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
