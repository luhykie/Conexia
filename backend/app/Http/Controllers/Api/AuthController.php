<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Profile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'max:255'],
        ]);

        $email = strtolower(trim($data['email']));
        $account = $this->resolveAccount($email);

        if (! $account || ! $this->passwordMatches($email, $data['password'])) {
            return response()->json(['message' => 'Invalid credentials.'], 422);
        }

        $token = $this->buildToken($account);

        return response()->json([
            'token' => $token,
            'user' => [
                'id' => $account->id,
                'email' => $email,
                'fullName' => $account->full_name,
                'role' => $account->role,
                'roleKey' => $account->role_key,
                'office' => $account->office,
                'department' => $account->department,
                'status' => $account->status,
            ],
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        /** @var Profile|null $profile */
        $profile = $request->attributes->get('authenticated_profile')
            ?: $request->attributes->get('auth_profile');

        if (! $profile) {
            return response()->json([
                'ok' => false,
                'message' => 'Authenticated profile is unavailable.',
            ], 401);
        }

        return response()->json([
            'ok' => true,
            'account' => [
                'id' => $profile->id,
                'name' => $profile->full_name,
                'fullName' => $profile->full_name,
                'email' => $profile->email ?? null,
                'role' => $profile->role,
                'roleKey' => $profile->role_key ?? $this->roleKey($profile->role),
                'departmentId' => $profile->department_id ?? null,
                'department' => $profile->department?->name ?? $profile->department ?? null,
                'departmentCode' => $profile->department?->code ?? null,
                'office' => $profile->office ?? null,
                'isActive' => (bool) ($profile->is_active ?? true),
                'status' => $profile->status ?? 'active',
            ],
            'user' => [
                'id' => $profile->id,
                'email' => $profile->email ?? null,
                'fullName' => $profile->full_name,
                'role' => $profile->role,
                'roleKey' => $profile->role_key ?? $this->roleKey($profile->role),
                'office' => $profile->office ?? null,
                'department' => $profile->department ?? null,
                'status' => $profile->status ?? 'active',
            ],
        ]);
    }

    private function resolveAccount(string $email): ?Profile
    {
        $accounts = [
            'admin@conexia.edu' => ['id' => '00000000-0000-4000-8000-000000000001', 'full_name' => 'Conexia Super Admin', 'role' => 'Super Admin', 'role_key' => 'super_admin', 'office' => 'System Administration', 'department' => '-', 'status' => 'active'],
            'irostaff@conexia.edu' => ['id' => '00000000-0000-4000-8000-000000000002', 'full_name' => 'PAIR IRO Staff', 'role' => 'IRO Staff', 'role_key' => 'iro_staff', 'office' => 'Partnerships and International Relations Office', 'department' => '-', 'status' => 'active'],
            'iroadmin@conexia.edu' => ['id' => '00000000-0000-4000-8000-000000000003', 'full_name' => 'PAIR IRO Administrator', 'role' => 'IRO Admin', 'role_key' => 'iro_admin', 'office' => 'Partnerships and International Relations Office', 'department' => '-', 'status' => 'active'],
            'legal@conexia.edu' => ['id' => '00000000-0000-4000-8000-000000000004', 'full_name' => 'Legal Counsel', 'role' => 'Legal Counsel', 'role_key' => 'legal_counsel', 'office' => 'Legal Office', 'department' => '-', 'status' => 'active'],
            'department@conexia.edu' => ['id' => '00000000-0000-4000-8000-000000000005', 'full_name' => 'Department Staff', 'role' => 'Department Staff', 'role_key' => 'department_staff', 'office' => 'Department Office', 'department' => 'Department', 'status' => 'active'],
        ];

        if (! isset($accounts[$email])) {
            return null;
        }

        return new Profile($accounts[$email] + ['email' => $email]);
    }

    private function passwordMatches(string $email, string $password): bool
    {
        if (app()->environment('local')) {
            return $password === 'password' || $password === 'conexia';
        }

        return Hash::check($password, '');
    }

    private function buildToken(Profile $profile): string
    {
        $payload = base64_encode(json_encode([
            'sub' => $profile->id,
            'email' => $profile->email ?? null,
            'role_key' => $profile->role_key,
            'full_name' => $profile->full_name,
            'role' => $profile->role,
            'office' => $profile->office,
            'department' => $profile->department,
            'status' => $profile->status,
            'iat' => now()->timestamp,
        ], JSON_UNESCAPED_SLASHES));

        $signature = hash_hmac('sha256', $payload, config('app.key'));

        return 'conexia.'.$payload.'.'.$signature;
    }

    private function roleKey(string $role): string
    {
        return match ($role) {
            Profile::ROLE_SUPER_ADMIN => 'super',
            Profile::ROLE_IRO_ADMIN => 'admin',
            Profile::ROLE_IRO_STAFF => 'staff',
            Profile::ROLE_LEGAL_COUNSEL => 'legal',
            default => 'department',
        };
    }
}
