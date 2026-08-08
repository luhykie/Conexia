<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RequireRole
{
    public function handle(
        Request $request,
        Closure $next,
        string ...$roles
    ): Response {
        $profile = $request->attributes->get('auth_profile');
        $role = $this->applicationRole($profile);

        if (! $profile || ! in_array($role, $roles, true)) {
            abort(403, 'Your role is not authorized to perform this action.');
        }

        return $next($request);
    }

    private function applicationRole(?object $profile): ?string
    {
        if (! $profile) {
            return null;
        }

        $role = strtolower(trim((string) ($profile->role ?? '')));
        $roleKey = strtolower(trim((string) ($profile->role_key ?? '')));

        return match ($role) {
            'super_admin', 'iro_admin', 'iro_staff',
            'legal_counsel', 'department_staff' => $role,
            'super' => 'super_admin',
            'admin' => 'iro_admin',
            'staff' => 'iro_staff',
            'legal' => 'legal_counsel',
            'department' => 'department_staff',
            default => match ($roleKey) {
                'super_admin', 'super' => 'super_admin',
                'admin' => 'iro_admin',
                'staff' => 'iro_staff',
                'legal' => 'legal_counsel',
                'department' => 'department_staff',
                default => null,
            },
        };
    }
}
