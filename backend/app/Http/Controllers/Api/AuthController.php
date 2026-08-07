<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Profile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    /**
     * Return the currently authenticated CONEXIA account.
     */
    public function me(Request $request): JsonResponse
    {
        /** @var Profile|null $profile */
        $profile = $request->attributes->get(
            'authenticated_profile'
        );

        if (!$profile) {
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
                'email' => $profile->email,
                'role' => $profile->role,
                'roleKey' => $this->roleKey($profile->role),
                'departmentId' => $profile->department_id,
                'department' => $profile->department?->name,
                'departmentCode' => $profile->department?->code,
                'isActive' => (bool) $profile->is_active,
            ],
        ]);
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
