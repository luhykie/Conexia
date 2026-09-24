<?php
// Auth guard: i-verify ang Supabase token ug i-attach ang active profile una modagan ang route.

namespace App\Http\Middleware;

use App\Models\Profile;
use App\Services\SupabaseAuthService;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateSupabaseUser
{
    // I-andam ang auth service pag-boot sa middleware.
    public function __construct(
        private readonly SupabaseAuthService $supabaseAuthService
    ) {
    }

    // I-validate ang bearer token ug i-attach ang active profile sa request.
    public function handle(Request $request, Closure $next): Response
    {
        $accessToken = $request->bearerToken();

        if (!$accessToken) {
            // Kung walay bearer token, wala nakaabot ang request sa protected route.
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
            // Kasagaran, empty ang user payload kung napakyas o na-expire ang token validation.
            Log::warning('Supabase auth middleware rejected request: token verification returned no user.', [
                'path' => $request->path(),
            ]);

            return $this->unauthorised(
                'Your authentication token is invalid or expired.'
            );
        }

        $profile = Profile::query()
            ->with('department')
            ->find($supabaseUser['id']);

        // I-match ang verified Supabase user sa local profile una paagian ang route.

        if (!$profile) {
            // Kung walay profile, valid ang token pero wala pa na-link ang local user record.
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
            // Magpabilin nga blocked ang inactive profiles bisan valid ang Supabase token.
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

        // A successful authenticated request counts as the department's first login and activates its directory status.
        if (
            $profile->department_id
            && Schema::hasColumn('departments', 'is_active')
        ) {
            $profile->department?->newQuery()
                ->whereKey($profile->department_id)
                ->where('is_active', false)
                ->update(['is_active' => true]);
        }

        // Ibutang ang verified Supabase payload ug profile sa request para sa controller checks.
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

    // Himoa ang JSON error payload para sa napakyas nga auth checks.
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
