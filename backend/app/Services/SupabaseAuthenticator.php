<?php

namespace App\Services;

use Illuminate\Auth\AuthenticationException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;

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
            'supabase-auth:v5:'.hash('sha256', $token),
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

        $usesGroupSchema = Schema::hasColumn('profiles', 'role_key');
        $databaseProfile = $usesGroupSchema
            ? DB::table('profiles')
                ->select('id', 'full_name', 'role', 'role_key', 'office', 'department', 'status')
                ->where('id', $userId)
                ->first()
            : DB::table('profiles')
                ->select('id', 'full_name', 'email', 'role', 'department_id', 'is_active')
                ->where('id', $userId)
                ->first();

        if (! $databaseProfile) {
            throw new AuthenticationException(
                'No profile is linked to this authenticated user.'
            );
        }

        $isActive = $usesGroupSchema
            ? $databaseProfile->status === 'active'
            : (bool) $databaseProfile->is_active;

        if (! $isActive) {
            throw new AuthenticationException('This account is inactive.');
        }

        $applicationRole = $usesGroupSchema
            ? match ($databaseProfile->role_key) {
                'super_admin' => 'super_admin',
                'admin' => 'iro_admin',
                'staff' => 'iro_staff',
                'legal' => 'legal_counsel',
                'department' => 'department_staff',
            }
            : $databaseProfile->role;

        $roleKey = $usesGroupSchema
            ? $databaseProfile->role_key
            : match ($databaseProfile->role) {
                'super_admin' => 'super_admin',
                'iro_admin' => 'admin',
                'iro_staff' => 'staff',
                'legal_counsel' => 'legal',
                'department_staff' => 'department',
            };

        return (object) [
            'id' => $databaseProfile->id,
            'full_name' => $databaseProfile->full_name,
            'email' => (string) ($response->json('email') ?: ($databaseProfile->email ?? '')),
            'role' => $applicationRole,
            'role_key' => $roleKey,
            'office' => $databaseProfile->office ?? null,
            'department' => $databaseProfile->department ?? null,
            'department_id' => $databaseProfile->department_id ?? null,
            'is_active' => true,
        ];
    }
}
