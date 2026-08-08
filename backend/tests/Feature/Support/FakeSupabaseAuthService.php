<?php

namespace Tests\Feature\Support;

use App\Services\SupabaseAuthService;

class FakeSupabaseAuthService extends SupabaseAuthService
{
    public function __construct(
        private readonly array $tokens
    ) {
    }

    public function getUserFromAccessToken(
        string $accessToken
    ): array {
        return $this->tokens[$accessToken] ?? [];
    }
}
