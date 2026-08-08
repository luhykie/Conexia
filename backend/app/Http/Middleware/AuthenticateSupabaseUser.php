<?php

namespace App\Http\Middleware;

use App\Models\Profile;
use App\Services\SupabaseAuthService;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Log;
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
            Log::warning('Supabase auth middleware rejected request: missing bearer token.', [
                'path' => $request->path(),
            ]);

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
            Log::warning('Supabase auth middleware rejected request: token verification returned no user.', [
                'path' => $request->path(),
            ]);

            return $this->unauthorised(
                'Your authentication token is invalid or expired.'
            );
        }

        try {
            $profile = Profile::query()
                ->with('department')
                ->find($supabaseUser['id']);
        } catch (QueryException|RuntimeException $exception) {
            Log::warning('Falling back to token-derived profile because the profiles table could not be queried.', [
                'path' => $request->path(),
                'message' => $exception->getMessage(),
            ]);

            $profile = $this->fallbackProfileFromSupabaseUser($supabaseUser);
        }

        if (!$profile) {
            Log::warning('Supabase auth middleware rejected request: profile not found.', [
                'path' => $request->path(),
                'supabase_user_id' => $supabaseUser['id'] ?? null,
            ]);

            return response()->json([
                'success' => false,
                'ok' => false,
                'message' => 'Your CONEXIA profile could not be found.',
                'errors' => [],
            ], 403);
        }

        if (!$profile->is_active) {
            Log::warning('Supabase auth middleware rejected request: profile inactive.', [
                'path' => $request->path(),
                'profile_id' => $profile->id,
            ]);

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

    /**
     * @param array<string, mixed> $supabaseUser
     */
    private function fallbackProfileFromSupabaseUser(array $supabaseUser): ?Profile
    {
        if (empty($supabaseUser['id'])) {
            return null;
        }

        $profile = new Profile();
        $roleKey = (string) ($supabaseUser['role_key'] ?? $this->roleKeyFromRole(
            (string) ($supabaseUser['role'] ?? 'Department Staff')
        ));
        $profile->forceFill([
            'id' => $supabaseUser['id'],
            'full_name' => $supabaseUser['full_name'] ?? $supabaseUser['name'] ?? $supabaseUser['user_metadata']['full_name'] ?? $supabaseUser['email'] ?? 'CONEXIA User',
            'email' => $supabaseUser['email'] ?? null,
            'role' => $this->roleFromKey($roleKey),
            'role_key' => $roleKey,
            'office' => $supabaseUser['office'] ?? null,
            'department' => $supabaseUser['department'] ?? null,
            'department_id' => $supabaseUser['department_id'] ?? null,
            'is_active' => (bool) ($supabaseUser['is_active'] ?? true),
            'status' => $supabaseUser['status'] ?? 'active',
        ]);

        return $profile;
    }

    private function roleKeyFromRole(string $role): string
    {
        return match ($role) {
            Profile::ROLE_DEPARTMENT_STAFF => 'department',
            Profile::ROLE_SUPER_ADMIN => 'super',
            Profile::ROLE_IRO_ADMIN => 'admin',
            Profile::ROLE_IRO_STAFF => 'staff',
            Profile::ROLE_LEGAL_COUNSEL => 'legal',
            default => 'department',
        };
    }

    private function roleFromKey(string $roleKey): string
    {
        return match ($roleKey) {
            'department' => Profile::ROLE_DEPARTMENT_STAFF,
            'department_staff' => Profile::ROLE_DEPARTMENT_STAFF,
            'super' => Profile::ROLE_SUPER_ADMIN,
            'super_admin' => Profile::ROLE_SUPER_ADMIN,
            'admin' => Profile::ROLE_IRO_ADMIN,
            'iro_admin' => Profile::ROLE_IRO_ADMIN,
            'staff' => Profile::ROLE_IRO_STAFF,
            'iro_staff' => Profile::ROLE_IRO_STAFF,
            'legal' => Profile::ROLE_LEGAL_COUNSEL,
            'legal_counsel' => Profile::ROLE_LEGAL_COUNSEL,
            default => Profile::ROLE_DEPARTMENT_STAFF,
        };
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
