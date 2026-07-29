<?php

namespace Tests\Feature\Users;

use App\Models\Profile;
use Tests\Feature\Support\SecurityTestCase;

class UserManagementAuthorizationTest extends SecurityTestCase
{
    public function test_user_directory_access_rules(): void
    {
        $this->getJson(
            '/api/users',
            $this->authHeaders($this->profile(Profile::ROLE_SUPER_ADMIN))
        )->assertOk();

        $this->getJson(
            '/api/users',
            $this->authHeaders($this->profile(Profile::ROLE_IRO_ADMIN))
        )->assertOk();

        $this->getJson(
            '/api/users?role=legal_counsel',
            $this->authHeaders($this->profile(Profile::ROLE_IRO_STAFF))
        )->assertOk();

        $this->getJson(
            '/api/users',
            $this->authHeaders($this->profile(Profile::ROLE_IRO_STAFF))
        )->assertForbidden();

        $this->getJson(
            '/api/users',
            $this->authHeaders($this->profile(Profile::ROLE_DEPARTMENT_STAFF))
        )->assertForbidden();
    }

    public function test_iro_admin_cannot_manage_super_admin_account(): void
    {
        $iroAdmin = $this->profile(Profile::ROLE_IRO_ADMIN);
        $superAdmin = $this->profile(Profile::ROLE_SUPER_ADMIN);

        $this->getJson(
            "/api/users/{$superAdmin->id}",
            $this->authHeaders($iroAdmin)
        )->assertForbidden();

        $this->patchJson(
            "/api/users/{$superAdmin->id}/status",
            ['is_active' => false],
            $this->authHeaders($iroAdmin)
        )->assertForbidden();

        $this->patchJson(
            "/api/users/{$superAdmin->id}/assignment",
            ['full_name' => 'Changed'],
            $this->authHeaders($iroAdmin)
        )->assertForbidden();
    }

    public function test_iro_admin_cannot_escalate_user_to_super_admin(): void
    {
        $iroAdmin = $this->profile(Profile::ROLE_IRO_ADMIN);
        $user = $this->profile(Profile::ROLE_IRO_STAFF);

        $this->patchJson(
            "/api/users/{$user->id}/assignment",
            ['role' => Profile::ROLE_SUPER_ADMIN],
            $this->authHeaders($iroAdmin)
        )->assertForbidden();
    }

    public function test_super_admin_can_manage_users(): void
    {
        $superAdmin = $this->profile(Profile::ROLE_SUPER_ADMIN);
        $user = $this->profile(Profile::ROLE_IRO_STAFF);

        $this->patchJson(
            "/api/users/{$user->id}/status",
            ['is_active' => false],
            $this->authHeaders($superAdmin)
        )
            ->assertOk()
            ->assertJsonPath('ok', true);
    }

    public function test_unauthorized_user_cannot_mutate_user_records(): void
    {
        $departmentUser = $this->profile(
            Profile::ROLE_DEPARTMENT_STAFF
        );
        $target = $this->profile(Profile::ROLE_IRO_STAFF);

        $this->patchJson(
            "/api/users/{$target->id}/status",
            ['is_active' => false],
            $this->authHeaders($departmentUser)
        )->assertForbidden();
    }
}
