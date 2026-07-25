<?php

namespace App\Http\Middleware;

use App\Models\Profile;
use App\Services\SupabaseJwtService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifySupabaseJwt
{
    public function __construct(private readonly SupabaseJwtService $jwtService)
    {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if (! $token) {
            return response()->json(['message' => 'Authentication required.'], 401);
        }

        if (app()->environment('local') && str_starts_with($token, 'dev:')) {
            $profile = $this->resolveDevProfile(substr($token, 4));

            if (! $profile) {
                return response()->json(['message' => 'Invalid development token.'], 401);
            }

            $request->attributes->set('auth_user_id', $profile->id);
            $request->attributes->set('auth_profile', $profile);

            return $next($request);
        }

        try {
            $claims = $this->jwtService->decode($token);
        } catch (\Throwable) {
            return response()->json(['message' => 'Invalid or expired token.'], 401);
        }

        $userId = $claims->sub ?? null;

        if (! $userId) {
            return response()->json(['message' => 'Token missing subject claim.'], 401);
        }

        $profile = Profile::query()->find($userId);

        if (! $profile || $profile->status !== 'active') {
            return response()->json(['message' => 'No active profile found for this account.'], 403);
        }

        $request->attributes->set('auth_user_id', $userId);
        $request->attributes->set('auth_profile', $profile);

        return $next($request);
    }

    private function resolveDevProfile(string $email): ?Profile
    {
        $devAccounts = [
            'admin@conexia.edu' => ['id' => '00000000-0000-4000-8000-000000000001', 'full_name' => 'Conexia Super Admin', 'role' => 'Super Admin', 'role_key' => 'super_admin', 'office' => 'System Administration', 'department' => '-'],
            'irostaff@conexia.edu' => ['id' => '00000000-0000-4000-8000-000000000002', 'full_name' => 'PAIR IRO Staff', 'role' => 'IRO Staff', 'role_key' => 'staff', 'office' => 'Partnerships and International Relations Office', 'department' => '-'],
            'iroadmin@conexia.edu' => ['id' => '00000000-0000-4000-8000-000000000003', 'full_name' => 'PAIR IRO Administrator', 'role' => 'IRO Admin', 'role_key' => 'admin', 'office' => 'Partnerships and International Relations Office', 'department' => '-'],
            'legal@conexia.edu' => ['id' => '00000000-0000-4000-8000-000000000004', 'full_name' => 'Legal Counsel', 'role' => 'Legal Counsel', 'role_key' => 'legal', 'office' => 'Legal Office', 'department' => '-'],
        ];

        $email = strtolower(trim($email));

        if (! isset($devAccounts[$email])) {
            if (str_ends_with($email, '@conexia.edu')) {
                return new Profile([
                    'id' => '00000000-0000-4000-8000-000000000010',
                    'full_name' => strtoupper(explode('@', $email)[0]).' Department Staff',
                    'role' => 'Department Staff',
                    'role_key' => 'department',
                    'office' => 'Department Office',
                    'department' => strtoupper(explode('@', $email)[0]),
                    'status' => 'active',
                ]);
            }

            return null;
        }

        return new Profile([...$devAccounts[$email], 'status' => 'active']);
    }
}
