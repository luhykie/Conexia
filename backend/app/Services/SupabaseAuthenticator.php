<?php

namespace App\Services;

use Illuminate\Auth\AuthenticationException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class SupabaseAuthenticator
{
    public function authenticate(string $token): object
    {
        $ttl = max(0, (int) config('services.supabase.auth_cache_ttl', 30));

        if ($ttl === 0) {
            return $this->authenticateRemotely($token);
        }

        // Never put the bearer token itself in a cache key or persisted value.
        // A short TTL avoids repeating the remote Supabase user lookup for every
        // API request while keeping profile/authorization changes responsive.
        $profile = Cache::remember(
            'supabase-auth:v2:'.hash('sha256', $token),
            now()->addSeconds($ttl),
            fn (): array => (array) $this->authenticateRemotely($token),
        );

        return (object) $profile;
    }

    private function authenticateRemotely(string $token): object
    {
        $url = rtrim((string) config('services.supabase.url'), '/');
        $anonKey = (string) config('services.supabase.anon_key');

        if ($url === '' || $anonKey === '') {
            throw new AuthenticationException(
                'Supabase authentication is not configured.'
            );
        }

        $response = Http::acceptJson()
            ->withHeaders(['apikey' => $anonKey])
            ->withToken($token)
            ->timeout(10)
            ->get("{$url}/auth/v1/user");

        if (! $response->successful()) {
            throw new AuthenticationException(
                'The Supabase access token is invalid or expired.'
            );
        }

        $userId = $response->json('id');

        if (! is_string($userId) || $userId === '') {
            throw new AuthenticationException(
                'Supabase did not return an authenticated user.'
            );
        }

        $profile = DB::table('profiles')
            ->select(
                'id',
                'full_name',
                'email',
                'role',
                'department_id',
                'is_active'
            )
            ->where('id', $userId)
            ->first();

        if (! $profile) {
            throw new AuthenticationException(
                'No profile is linked to this authenticated user.'
            );
        }

        if (! $profile->is_active) {
            throw new AuthenticationException('This account is inactive.');
        }

        return $profile;
    }
}
