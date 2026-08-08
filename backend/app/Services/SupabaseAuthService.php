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
use Illuminate\Support\Facades\Log;
use RuntimeException;
use UnexpectedValueException;

class SupabaseAuthService
{
    /**
     * @var array<string, array<string, mixed>>
     */
    private static array $runtimeJwks = [];

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

        $header = $this->headerFromToken($accessToken);

        if ($header === []) {
            Log::warning('Supabase auth rejected token: malformed JWT header.');

            return [];
        }

        $algorithm = $header['alg'] ?? null;

        $claims = match ($algorithm) {
            'ES256' => empty($header['kid'])
                ? null
                : $this->decodeWithJwks($accessToken, (string) $header['kid']),
            'HS256' => $this->decodeWithJwtSecret($accessToken),
            default => null,
        };

        if ($claims !== null) {
            return $this->userFromClaims($claims, $supabaseUrl);
        }

        return $this->userFromSupabase($accessToken, $supabaseUrl);
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
            return $this->decodeJwt($accessToken, $key);
        } catch (SignatureInvalidException) {
            $refreshedKey = $this->keyForKid($kid, forceRefresh: true);

            if ($refreshedKey === null) {
                return null;
            }

            try {
                return $this->decodeJwt($accessToken, $refreshedKey);
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

    private function decodeWithJwtSecret(string $accessToken): ?object
    {
        $jwtSecret = (string) config('supabase.jwt_secret', '');

        if ($jwtSecret === '') {
            return null;
        }

        try {
            return $this->decodeJwt(
                $accessToken,
                new Key($jwtSecret, 'HS256')
            );
        } catch (
            BeforeValidException |
            ExpiredException |
            SignatureInvalidException |
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

    private function decodeJwt(string $accessToken, Key $key): object
    {
        $previousLeeway = JWT::$leeway;
        JWT::$leeway = max(
            0,
            (int) config('supabase.jwt_leeway_seconds', 60)
        );

        try {
            return JWT::decode($accessToken, $key);
        } finally {
            JWT::$leeway = $previousLeeway;
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function jwks(bool $forceRefresh = false): array
    {
        $cacheKey = $this->jwksCacheKey();
        $useRuntimeCache = !app()->environment('testing');
        $ttl = (int) config('supabase.jwks_cache_seconds', 3600);

        if ($forceRefresh) {
            Cache::forget($cacheKey);
            unset(self::$runtimeJwks[$cacheKey]);
        }

        if (
            $useRuntimeCache &&
            isset(self::$runtimeJwks[$cacheKey])
        ) {
            return self::$runtimeJwks[$cacheKey];
        }

        $jwks = Cache::get($cacheKey);

        if (!is_array($jwks)) {
            $jwks = Cache::lock($cacheKey.':lock', 10)
                ->block(3, function () use ($cacheKey, $ttl): array {
                    $cached = Cache::get($cacheKey);

                    if (is_array($cached)) {
                        return $cached;
                    }

                    $fresh = $this->fetchJwks();

                    Cache::put($cacheKey, $fresh, $ttl);

                    return $fresh;
                });
        }

        if ($useRuntimeCache) {
            self::$runtimeJwks[$cacheKey] = $jwks;
        }

        return $jwks;
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

    /**
     * @return array<string, mixed>
     */
    private function headerFromToken(string $accessToken): array
    {
        $parts = explode('.', $accessToken);

        if (count($parts) !== 3) {
            return [];
        }

        $header = json_decode($this->base64UrlDecode($parts[0]), true);

        return is_array($header) ? $header : [];
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

        if (!$this->claimsAreValid($claimsArray, $expectedIssuer, $audience)) {
            Log::warning('Supabase auth rejected token: verified claims are invalid.', [
                'issuer_matches' => ($claimsArray['iss'] ?? null) === $expectedIssuer,
                'audience' => $audience,
                'has_subject' => !empty($claimsArray['sub']),
                'has_exp' => !empty($claimsArray['exp']),
                'exp_is_numeric' => is_numeric($claimsArray['exp'] ?? null),
            ]);

            return [];
        }

        return array_merge($claimsArray, [
            'id' => $claimsArray['sub'],
            'claims' => $claimsArray,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function userFromSupabase(string $accessToken, string $supabaseUrl): array
    {
        $claimsArray = $this->payloadFromToken($accessToken);
        $expectedIssuer = "{$supabaseUrl}/auth/v1";
        $audience = $claimsArray['aud'] ?? null;

        if (!$this->claimsAreValid($claimsArray, $expectedIssuer, $audience)) {
            Log::warning('Supabase auth rejected token before remote verification: claims are invalid.', [
                'issuer_matches' => ($claimsArray['iss'] ?? null) === $expectedIssuer,
                'audience' => $audience,
                'has_subject' => !empty($claimsArray['sub']),
                'has_exp' => !empty($claimsArray['exp']),
                'exp_is_numeric' => is_numeric($claimsArray['exp'] ?? null),
            ]);

            return [];
        }

        $publishableKey = (string) config('supabase.publishable_key', '');

        if ($publishableKey === '') {
            throw new RuntimeException(
                'Supabase authentication configuration is missing.'
            );
        }

        try {
            $response = Http::acceptJson()
                ->withHeaders(['apikey' => $publishableKey])
                ->withToken($accessToken)
                ->timeout(10)
                ->get("{$supabaseUrl}/auth/v1/user");
        } catch (ConnectionException $exception) {
            throw new RuntimeException(
                'The authentication service is currently unavailable.',
                previous: $exception
            );
        }

        if ($response->status() === 401 || $response->status() === 403) {
            Log::warning('Supabase auth remote user verification rejected token.', [
                'status' => $response->status(),
            ]);

            return [];
        }

        if ($response->failed()) {
            throw new RuntimeException(
                'Supabase user verification failed.'
            );
        }

        $supabaseUser = $response->json();

        if (
            !is_array($supabaseUser) ||
            ($supabaseUser['id'] ?? null) !== $claimsArray['sub']
        ) {
            Log::warning('Supabase auth remote user verification returned mismatched user.', [
                'has_user_id' => is_array($supabaseUser) && !empty($supabaseUser['id']),
                'subject' => $claimsArray['sub'] ?? null,
            ]);

            return [];
        }

        return array_merge($claimsArray, [
            'id' => $claimsArray['sub'],
            'email' => $supabaseUser['email'] ?? $claimsArray['email'] ?? null,
            'claims' => $claimsArray,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function payloadFromToken(string $accessToken): array
    {
        $parts = explode('.', $accessToken);

        if (count($parts) !== 3) {
            return [];
        }

        $payload = json_decode($this->base64UrlDecode($parts[1]), true);

        return is_array($payload) ? $payload : [];
    }

    /**
     * @param array<string, mixed> $claimsArray
     */
    private function claimsAreValid(
        array $claimsArray,
        string $expectedIssuer,
        mixed $audience
    ): bool {
        return ($claimsArray['iss'] ?? null) === $expectedIssuer &&
            $this->hasAuthenticatedAudience($audience) &&
            !empty($claimsArray['sub']) &&
            !empty($claimsArray['exp']) &&
            is_numeric($claimsArray['exp']) &&
            (int) $claimsArray['exp'] > time();
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
