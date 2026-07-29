<?php

namespace App\Services;

use Firebase\JWT\BeforeValidException;
use Firebase\JWT\ExpiredException;
use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Firebase\JWT\SignatureInvalidException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use UnexpectedValueException;

class SupabaseAuthService
{
    /**
     * Validate a Supabase access token and return the authenticated Auth user.
     *
     * @return array<string, mixed>
     */
    public function getUserFromAccessToken(string $accessToken): array
    {
        $supabaseUrl = rtrim((string) config('supabase.url'), '/');

        if ($supabaseUrl === '') {
            throw new RuntimeException(
                'Supabase authentication configuration is missing.'
            );
        }

        $kid = $this->kidFromToken($accessToken);

        if ($kid === null) {
            return [];
        }

        $claims = $this->decodeWithJwks($accessToken, $kid);

        if ($claims === null) {
            return [];
        }

        return $this->userFromClaims($claims, $supabaseUrl);
    }

    private function decodeWithJwks(string $accessToken, string $kid): ?object
    {
        $key = $this->keyForKid($kid);

        if ($key === null) {
            $key = $this->keyForKid($kid, forceRefresh: true);
        }

        if ($key === null) {
            return null;
        }

        try {
            return JWT::decode($accessToken, $key);
        } catch (SignatureInvalidException) {
            $refreshedKey = $this->keyForKid($kid, forceRefresh: true);

            if ($refreshedKey === null) {
                return null;
            }

            try {
                return JWT::decode($accessToken, $refreshedKey);
            } catch (
                BeforeValidException |
                ExpiredException |
                SignatureInvalidException |
                UnexpectedValueException
            ) {
                return null;
            }
        } catch (
            BeforeValidException |
            ExpiredException |
            UnexpectedValueException
        ) {
            return null;
        }
    }

    private function keyForKid(string $kid, bool $forceRefresh = false): ?Key
    {
        $jwks = $this->jwks($forceRefresh);

        $matchingJwk = collect($jwks['keys'] ?? [])
            ->first(fn (array $key): bool => ($key['kid'] ?? null) === $kid);

        if (
            !is_array($matchingJwk) ||
            (($matchingJwk['alg'] ?? 'ES256') !== 'ES256')
        ) {
            return null;
        }

        $keys = JWK::parseKeySet(['keys' => [$matchingJwk]], 'ES256');

        return $keys[$kid] ?? null;
    }

    /**
     * @return array<string, mixed>
     */
    private function jwks(bool $forceRefresh = false): array
    {
        $cacheKey = $this->jwksCacheKey();

        if ($forceRefresh) {
            Cache::forget($cacheKey);
        }

        return Cache::remember(
            $cacheKey,
            (int) config('supabase.jwks_cache_seconds', 3600),
            fn (): array => $this->fetchJwks()
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function fetchJwks(): array
    {
        $supabaseUrl = rtrim((string) config('supabase.url'), '/');

        try {
            $response = Http::acceptJson()
                ->timeout(10)
                ->get("{$supabaseUrl}/auth/v1/.well-known/jwks.json");
        } catch (ConnectionException $exception) {
            throw new RuntimeException(
                'The authentication service is currently unavailable.',
                previous: $exception
            );
        }

        if ($response->failed()) {
            throw new RuntimeException(
                'Supabase JWKS could not be loaded.'
            );
        }

        $jwks = $response->json();

        if (!is_array($jwks) || empty($jwks['keys'])) {
            throw new RuntimeException(
                'Supabase JWKS response is invalid.'
            );
        }

        return $jwks;
    }

    private function kidFromToken(string $accessToken): ?string
    {
        $parts = explode('.', $accessToken);

        if (count($parts) !== 3) {
            return null;
        }

        $header = json_decode($this->base64UrlDecode($parts[0]), true);

        if (
            !is_array($header) ||
            ($header['alg'] ?? null) !== 'ES256' ||
            empty($header['kid'])
        ) {
            return null;
        }

        return (string) $header['kid'];
    }

    private function base64UrlDecode(string $value): string
    {
        $remainder = strlen($value) % 4;

        if ($remainder > 0) {
            $value .= str_repeat('=', 4 - $remainder);
        }

        return base64_decode(strtr($value, '-_', '+/'), strict: true) ?: '';
    }

    /**
     * @return array<string, mixed>
     */
    private function userFromClaims(object $claims, string $supabaseUrl): array
    {
        $claimsArray = json_decode(json_encode($claims), true);

        if (!is_array($claimsArray)) {
            return [];
        }

        $expectedIssuer = "{$supabaseUrl}/auth/v1";
        $audience = $claimsArray['aud'] ?? null;

        if (
            ($claimsArray['iss'] ?? null) !== $expectedIssuer ||
            !$this->hasAuthenticatedAudience($audience) ||
            empty($claimsArray['sub']) ||
            empty($claimsArray['exp']) ||
            !is_numeric($claimsArray['exp'])
        ) {
            return [];
        }

        return array_merge($claimsArray, [
            'id' => $claimsArray['sub'],
            'claims' => $claimsArray,
        ]);
    }

    private function hasAuthenticatedAudience(mixed $audience): bool
    {
        if (is_string($audience)) {
            return $audience === 'authenticated';
        }

        if (is_array($audience)) {
            return in_array('authenticated', $audience, strict: true);
        }

        return false;
    }

    private function jwksCacheKey(): string
    {
        $supabaseUrl = rtrim((string) config('supabase.url'), '/');

        return 'supabase:jwks:'.sha1($supabaseUrl);
    }
}
