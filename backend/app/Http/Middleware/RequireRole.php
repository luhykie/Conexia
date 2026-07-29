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

        if (! $profile || ! in_array($profile->role, $roles, true)) {
            abort(403, 'Your role is not authorized to perform this action.');
        }

        return $next($request);
    }
}
