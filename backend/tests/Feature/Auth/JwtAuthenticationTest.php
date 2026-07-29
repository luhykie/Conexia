<?php

namespace Tests\Feature\Auth;

use App\Models\Profile;
use Tests\Feature\Support\SecurityTestCase;

class JwtAuthenticationTest extends SecurityTestCase
{
    public function test_protected_route_rejects_missing_token(): void
    {
        $this->getJson('/api/me')
            ->assertUnauthorized();
    }

    public function test_protected_route_rejects_malformed_bearer_token(): void
    {
        $this->getJson('/api/me', [
            'Authorization' => 'Basic not-a-bearer-token',
        ])->assertUnauthorized();
    }

    public function test_protected_route_rejects_invalid_token(): void
    {
        $this->getJson('/api/me', [
            'Authorization' => 'Bearer '.$this->invalidToken(),
        ])->assertUnauthorized();
    }

    public function test_protected_route_rejects_expired_token(): void
    {
        $this->getJson('/api/me', [
            'Authorization' => 'Bearer '.$this->expiredToken(),
        ])->assertUnauthorized();
    }

    public function test_valid_token_continues_to_authorization(): void
    {
        $departmentStaff = $this->profile(
            Profile::ROLE_DEPARTMENT_STAFF
        );

        $this->getJson(
            '/api/legal/documents/review',
            $this->authHeaders($departmentStaff)
        )->assertForbidden();
    }

    public function test_valid_token_can_access_me_endpoint(): void
    {
        $legal = $this->profile(Profile::ROLE_LEGAL_COUNSEL);

        $this->getJson('/api/me', $this->authHeaders($legal))
            ->assertOk()
            ->assertJsonPath('ok', true);
    }
}
