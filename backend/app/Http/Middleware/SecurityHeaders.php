<?php
// SECURITY: idugang ang basic browser hardening headers para mas safe ang API responses.

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SecurityHeaders
{
    // Idugang ang baseline headers para mas safe ang browser behavior sa matag response.
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // I-protect ang response batok sa MIME confusion ug basic clickjacking.
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set(
            'Permissions-Policy',
            'camera=(), microphone=(), geolocation=()'
        );

        return $response;
    }
}
