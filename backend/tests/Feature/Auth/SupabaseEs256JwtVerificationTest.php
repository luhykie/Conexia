<?php

namespace Tests\Feature\Auth;

use App\Models\Profile;
use App\Services\SupabaseAuthService;
use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\Feature\Support\SecurityTestCase;

class SupabaseEs256JwtVerificationTest extends SecurityTestCase
{
    private string $supabaseUrl = 'https://example.supabase.co';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'supabase.url' => $this->supabaseUrl,
            'supabase.jwks_cache_seconds' => 3600,
            'supabase.jwt_leeway_seconds' => 60,
        ]);

        Cache::flush();

        $this->app->instance(
            SupabaseAuthService::class,
            new SupabaseAuthService()
        );
    }

    public function test_valid_es256_token_can_access_me_and_caches_jwks(): void
    {
        $profile = $this->profile(Profile::ROLE_LEGAL_COUNSEL);
        $keys = $this->keyPair('kid-one');
        $token = $this->tokenForClaims($profile->id, $keys['private']);

        Http::fake([
            $this->jwksUrl() => Http::response($this->jwks($keys['jwk'])),
        ]);

        $headers = ['Authorization' => 'Bearer '.$token];

        $this->getJson('/api/me', $headers)
            ->assertOk()
            ->assertJsonPath('ok', true);

        $this->getJson('/api/me', $headers)
            ->assertOk()
            ->assertJsonPath('ok', true);

        Http::assertSentCount(1);
    }

    public function test_valid_es256_token_with_small_clock_skew_verifies_locally(): void
    {
        $profile = $this->profile(Profile::ROLE_LEGAL_COUNSEL);
        $keys = $this->keyPair('kid-one');
        $token = $this->tokenForClaims(
            $profile->id,
            $keys['private'],
            issuedAt: time() + 30
        );

        Http::fake([
            $this->jwksUrl() => Http::response($this->jwks($keys['jwk'])),
            "{$this->supabaseUrl}/auth/v1/user" => Http::response([], 500),
        ]);

        $this->getJson('/api/me', [
            'Authorization' => 'Bearer '.$token,
        ])
            ->assertOk()
            ->assertJsonPath('ok', true);

        Http::assertSentCount(1);
    }

    public function test_unknown_kid_returns_unauthorized_after_jwks_refresh(): void
    {
        $profile = $this->profile(Profile::ROLE_LEGAL_COUNSEL);
        $knownKeys = $this->keyPair('known-kid', 1);
        $unknownKeys = $this->keyPair('unknown-kid');
        $token = $this->tokenForClaims(
            $profile->id,
            $unknownKeys['private'],
            kid: 'unknown-kid'
        );

        Http::fakeSequence()
            ->push($this->jwks($knownKeys['jwk']))
            ->push($this->jwks($knownKeys['jwk']))
            ->push([], 401);

        $this->getJson('/api/me', [
            'Authorization' => 'Bearer '.$token,
        ])->assertUnauthorized();

        Http::assertSentCount(3);
    }

    public function test_invalid_signature_returns_unauthorized_after_jwks_refresh(): void
    {
        $profile = $this->profile(Profile::ROLE_LEGAL_COUNSEL);
        $signingKeys = $this->keyPair('kid-one');
        $wrongKeys = $this->keyPair('kid-one', 1);
        $token = $this->tokenForClaims($profile->id, $signingKeys['private']);

        Http::fakeSequence()
            ->push($this->jwks($wrongKeys['jwk']))
            ->push($this->jwks($wrongKeys['jwk']))
            ->push([], 401);

        $this->getJson('/api/me', [
            'Authorization' => 'Bearer '.$token,
        ])->assertUnauthorized();

        Http::assertSentCount(3);
    }

    public function test_expired_token_returns_unauthorized(): void
    {
        $profile = $this->profile(Profile::ROLE_LEGAL_COUNSEL);
        $keys = $this->keyPair('kid-one');
        $token = $this->tokenForClaims(
            $profile->id,
            $keys['private'],
            expiresAt: time() - 60
        );

        Http::fake([
            $this->jwksUrl() => Http::response($this->jwks($keys['jwk'])),
        ]);

        $this->getJson('/api/me', [
            'Authorization' => 'Bearer '.$token,
        ])->assertUnauthorized();
    }

    public function test_issuer_mismatch_returns_unauthorized(): void
    {
        $profile = $this->profile(Profile::ROLE_LEGAL_COUNSEL);
        $keys = $this->keyPair('kid-one');
        $token = $this->tokenForClaims(
            $profile->id,
            $keys['private'],
            issuer: 'https://wrong.example.test/auth/v1'
        );

        Http::fake([
            $this->jwksUrl() => Http::response($this->jwks($keys['jwk'])),
        ]);

        $this->getJson('/api/me', [
            'Authorization' => 'Bearer '.$token,
        ])->assertUnauthorized();
    }

    public function test_audience_mismatch_returns_unauthorized(): void
    {
        $profile = $this->profile(Profile::ROLE_LEGAL_COUNSEL);
        $keys = $this->keyPair('kid-one');
        $token = $this->tokenForClaims(
            $profile->id,
            $keys['private'],
            audience: 'anon'
        );

        Http::fake([
            $this->jwksUrl() => Http::response($this->jwks($keys['jwk'])),
        ]);

        $this->getJson('/api/me', [
            'Authorization' => 'Bearer '.$token,
        ])->assertUnauthorized();
    }

    /**
     * @return array{private: string, jwk: array<string, string>}
     */
    private function keyPair(string $kid, int $fixture = 0): array
    {
        $fixtures = [
            [
                'private' => <<<PEM
-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg9AEhiAzmVuXz7Y37
llXSuW6Lt2xJIjucYwvJgm6amT6hRANCAASIDdIlVrhbMIZhwuW5IwCSYmUvi8nZ
KGsd9wsxQSlIaQPB93Idgk1s3Lb+m73fms35IcLSWpQ5r16edlAnOUil
-----END PRIVATE KEY-----
PEM,
                'x' => 'iA3SJVa4WzCGYcLluSMAkmJlL4vJ2ShrHfcLMUEpSGk',
                'y' => 'A8H3ch2CTWzctv6bvd-azfkhwtJalDmvXp52UCc5SKU',
            ],
            [
                'private' => <<<PEM
-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgpXR2X7vwY7xAAnZq
KoFQDVfs+qXR3bR0yO0DbWWd8AyhRANCAAS5Gar6NcSZ2B/kE+pLqQC89frpql21
MuHUShV990AQl8c4l5wcvUsb0IdzMM3zvQmKXdmiwre8gljMNQ7WQNOh
-----END PRIVATE KEY-----
PEM,
                'x' => 'uRmq-jXEmdgf5BPqS6kAvPX66apdtTLh1EoVffdAEJc',
                'y' => 'xziXnBy9SxvQh3MwzfO9CYpd2aLCt7yCWMw1DtZA06E',
            ],
        ];

        $key = $fixtures[$fixture];

        return [
            'private' => $key['private'],
            'jwk' => [
                'kty' => 'EC',
                'kid' => $kid,
                'use' => 'sig',
                'alg' => 'ES256',
                'crv' => 'P-256',
                'x' => $key['x'],
                'y' => $key['y'],
            ],
        ];
    }

    private function tokenForClaims(
        string $subject,
        string $privateKey,
        string $kid = 'kid-one',
        ?int $expiresAt = null,
        ?string $issuer = null,
        string $audience = 'authenticated',
        ?int $issuedAt = null
    ): string {
        return JWT::encode([
            'iss' => $issuer ?? $this->supabaseUrl.'/auth/v1',
            'aud' => $audience,
            'exp' => $expiresAt ?? time() + 3600,
            'iat' => $issuedAt ?? time(),
            'sub' => $subject,
            'email' => 'legal@example.test',
        ], $privateKey, 'ES256', $kid);
    }

    /**
     * @return array<string, array<int, array<string, string>>>
     */
    private function jwks(array $jwk): array
    {
        return ['keys' => [$jwk]];
    }

    private function jwksUrl(): string
    {
        return $this->supabaseUrl.'/auth/v1/.well-known/jwks.json';
    }

}
