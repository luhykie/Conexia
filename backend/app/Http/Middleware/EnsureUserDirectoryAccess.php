<?php
// [FEATURE: User Management] - manages user profiles, accounts, and directory access.

namespace App\Http\Middleware;

use App\Models\Profile;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserDirectoryAccess
{
    // Allows only roles permitted to view the requested user-directory scope.
    public function handle(Request $request, Closure $next): Response
    {
        $profile = $request->attributes->get(
            'authenticated_profile'
        );

        if (!$profile) {
            return $this->error(
                'Authentication is required.',
                401
            );
        }

        if (
            in_array($profile->role, [
                Profile::ROLE_SUPER_ADMIN,
                Profile::ROLE_IRO_ADMIN,
            ], true)
        ) {
            return $next($request);
        }

        return $this->error(
            'You do not have permission to access the user directory.',
            403
        );
    }

    // Returns a consistent authorization error response.
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
