<?php

namespace App\Http\Middleware;

use App\Models\Profile;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifySupabaseJwt
{
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
            $profile = $this->decodeToken($token);
        } catch (\Throwable) {
            return response()->json(['message' => 'Invalid or expired token.'], 401);
        }

        if (! $profile || $profile->status !== 'active') {
            return response()->json(['message' => 'No active profile found for this account.'], 403);
        }

        $request->attributes->set('auth_user_id', $profile->id);
        $request->attributes->set('auth_profile', $profile);

        return $next($request);
    }

    private function decodeToken(string $token): ?Profile
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3 || $parts[0] !== 'conexia') {
            throw new \RuntimeException('Invalid token format.');
        }

        [, $payload, $signature] = $parts;
        $expected = hash_hmac('sha256', $payload, config('app.key'));

        if (! hash_equals($expected, $signature)) {
            throw new \RuntimeException('Invalid token signature.');
        }

        $decoded = json_decode(base64_decode($payload, true) ?: '', true);
        if (! is_array($decoded) || empty($decoded['sub'])) {
            throw new \RuntimeException('Invalid token payload.');
        }

        return new Profile([
            'id' => $decoded['sub'],
            'full_name' => $decoded['full_name'] ?? 'Conexia User',
            'role' => $decoded['role'] ?? 'Department Staff',
            'role_key' => $decoded['role_key'] ?? 'department',
            'office' => $decoded['office'] ?? 'Department Office',
            'department' => $decoded['department'] ?? '-',
            'status' => $decoded['status'] ?? 'active',
            'email' => $decoded['email'] ?? null,
        ]);
    }

    private function resolveDevProfile(string $email): ?Profile
    {
        $profiles = [
            'admin@conexia.edu' => ['id' => '00000000-0000-4000-8000-000000000001', 'full_name' => 'Conexia Super Admin', 'role' => 'Super Admin', 'role_key' => 'super', 'office' => 'System Administration', 'department' => '-', 'status' => 'active'],
            'irostaff@conexia.edu' => ['id' => '00000000-0000-4000-8000-000000000002', 'full_name' => 'PAIR IRO Staff', 'role' => 'IRO Staff', 'role_key' => 'staff', 'office' => 'Partnerships and International Relations Office', 'department' => '-', 'status' => 'active'],
            'iroadmin@conexia.edu' => ['id' => '00000000-0000-4000-8000-000000000003', 'full_name' => 'PAIR IRO Administrator', 'role' => 'IRO Admin', 'role_key' => 'admin', 'office' => 'Partnerships and International Relations Office', 'department' => '-', 'status' => 'active'],
            'legal@conexia.edu' => ['id' => '00000000-0000-4000-8000-000000000004', 'full_name' => 'Legal Counsel', 'role' => 'Legal Counsel', 'role_key' => 'legal', 'office' => 'Legal Office', 'department' => '-', 'status' => 'active'],
        ];

        $email = strtolower(trim($email));

        if (isset($profiles[$email])) {
            return new Profile($profiles[$email] + ['email' => $email]);
        }

        if (str_ends_with($email, '@conexia.edu')) {
            $localPart = explode('@', $email)[0];
            return new Profile([
                'id' => '00000000-0000-4000-8000-000000000010',
                'full_name' => 'Department Staff',
                'role' => 'Department Staff',
                'role_key' => 'department',
                'office' => 'Department Office',
                'department' => strtoupper($localPart),
                'status' => 'active',
                'email' => $email,
            ]);
        }

        return null;
    }
}
