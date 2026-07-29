<?php

namespace App\Http\Middleware;

use App\Models\Profile;
use App\Services\SupabaseAuthService;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateSupabaseUser
{
    public function __construct(
        private readonly SupabaseAuthService $supabaseAuthService
    ) {
    }

    /**
     * Validate the bearer token and attach the authenticated profile
     * to the current Laravel request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $accessToken = $request->bearerToken();

        if (!$accessToken) {
            return $this->unauthorised(
                'Authentication token is required.'
            );
        }

        try {
            $supabaseUser =
                $this->supabaseAuthService
                    ->getUserFromAccessToken($accessToken);
        } catch (RuntimeException $exception) {
            report($exception);

            return response()->json([
                'success' => false,
                'ok' => false,
                'message' => $exception->getMessage(),
                'errors' => [],
            ], 503);
        }

        if ($supabaseUser === []) {
            return $this->unauthorised(
                'Your authentication token is invalid or expired.'
            );
        }

        $profile = Profile::query()
            ->with('department')
            ->find($supabaseUser['id']);

        if (!$profile) {
            return response()->json([
                'success' => false,
                'ok' => false,
                'message' => 'Your CONEXIA profile could not be found.',
                'errors' => [],
            ], 403);
        }

        if (!$profile->is_active) {
            return response()->json([
                'success' => false,
                'ok' => false,
                'message' => 'Your account has been deactivated.',
                'errors' => [],
            ], 403);
        }

        /*
         * Make the authenticated Supabase user and CONEXIA profile
         * available to controllers.
         */
        $request->attributes->set(
            'supabase_user',
            $supabaseUser
        );

        $request->attributes->set(
            'authenticated_profile',
            $profile
        );

        return $next($request);
    }

    private function unauthorised(string $message): JsonResponse
    {
        return response()->json([
            'success' => false,
            'ok' => false,
            'message' => $message,
            'errors' => [],
        ], 401);
    }
}
