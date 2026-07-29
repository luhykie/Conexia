<?php

namespace App\Http\Middleware;

use App\Services\SupabaseAuthenticator;
use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateSupabase
{
    public function __construct(
        private readonly SupabaseAuthenticator $authenticator
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if (! $token) {
            throw new AuthenticationException(
                'A Supabase Bearer token is required.'
            );
        }

        $profile = $this->authenticator->authenticate($token);

        $request->attributes->set('auth_profile', $profile);
        $request->setUserResolver(fn () => $profile);

        return $next($request);
    }
}
