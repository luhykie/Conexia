<?php

namespace Tests\Feature\Users;

use App\Models\AuditLog;
use App\Models\Profile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\Feature\Support\SecurityTestCase;

class SuperAdminActionsTest extends SecurityTestCase
{
    public function test_super_admin_can_create_user_profile_through_supabase_admin(): void
    {
        $admin = $this->profile(Profile::ROLE_SUPER_ADMIN);
        $department = $this->department();
        $supabaseUserId = (string) Str::uuid();

        config([
            'supabase.url' => 'https://conexia-test.supabase.co',
            'supabase.service_role_key' => 'service-role-test',
        ]);

        Http::fake([
            '*/auth/v1/admin/users' => Http::response([
                'id' => $supabaseUserId,
            ], 200),
        ]);

        $response = $this
            ->withHeaders($this->authHeaders($admin))
            ->postJson('/api/users', [
                'full_name' => 'New Department Staff',
                'email' => 'new.staff@conexia.test',
                'role' => Profile::ROLE_DEPARTMENT_STAFF,
                'department_id' => $department->id,
                'is_active' => true,
            ]);

        $response->assertCreated()
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('profiles', [
            'id' => $supabaseUserId,
            'email' => 'new.staff@conexia.test',
            'role' => Profile::ROLE_DEPARTMENT_STAFF,
            'department_id' => $department->id,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => $admin->id,
            'action' => 'super_admin.user.created',
        ]);
    }

    public function test_only_super_admin_can_create_departments(): void
    {
        $admin = $this->profile(Profile::ROLE_SUPER_ADMIN);
        $iroAdmin = $this->profile(Profile::ROLE_IRO_ADMIN);

        $this
            ->withHeaders($this->authHeaders($iroAdmin))
            ->postJson('/api/departments', [
                'code' => 'NEW',
                'name' => 'New School',
            ])
            ->assertForbidden();

        $this
            ->withHeaders($this->authHeaders($admin))
            ->postJson('/api/departments', [
                'code' => 'NEW',
                'name' => 'New School',
                'email' => 'new@conexia.test',
            ])
            ->assertCreated()
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('departments', [
            'code' => 'NEW',
            'name' => 'New School',
        ]);
    }

    public function test_role_settings_reject_protected_boundary_changes(): void
    {
        $admin = $this->profile(Profile::ROLE_SUPER_ADMIN);

        $this
            ->withHeaders($this->authHeaders($admin))
            ->patchJson('/api/super-admin/roles', [
                'permissions' => [
                    Profile::ROLE_SUPER_ADMIN => [
                        'document_contents' => true,
                    ],
                ],
            ])
            ->assertUnprocessable()
            ->assertJsonPath('success', false);
    }

    public function test_role_settings_persist_allowed_permission_changes(): void
    {
        $admin = $this->profile(Profile::ROLE_SUPER_ADMIN);

        $this
            ->withHeaders($this->authHeaders($admin))
            ->patchJson('/api/super-admin/roles', [
                'permissions' => [
                    Profile::ROLE_IRO_ADMIN => [
                        'governance' => false,
                        'document_contents' => true,
                        'files' => true,
                        'workflow' => true,
                        'assign_legal' => true,
                        'user_management' => false,
                        'department_management' => true,
                        'audit_logs' => true,
                        'system_monitoring' => true,
                    ],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('role_permissions', [
            'role' => Profile::ROLE_IRO_ADMIN,
            'updated_by' => $admin->id,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => $admin->id,
            'action' => 'super_admin.roles.updated',
        ]);
    }

    public function test_iro_staff_locked_permissions_remain_protected(): void
    {
        $admin = $this->profile(Profile::ROLE_SUPER_ADMIN);

        $this
            ->withHeaders($this->authHeaders($admin))
            ->patchJson('/api/super-admin/roles', [
                'permissions' => [
                    Profile::ROLE_IRO_STAFF => [
                        'files' => true,
                    ],
                ],
            ])
            ->assertUnprocessable();
    }

    public function test_audit_logs_are_super_admin_only(): void
    {
        $admin = $this->profile(Profile::ROLE_SUPER_ADMIN);
        $staff = $this->profile(Profile::ROLE_DEPARTMENT_STAFF);

        AuditLog::query()->create([
            'actor_id' => $admin->id,
            'action' => 'super_admin.tested',
            'metadata' => ['source' => 'test'],
        ]);

        $this
            ->withHeaders($this->authHeaders($staff))
            ->getJson('/api/super-admin/audit-logs')
            ->assertForbidden();

        $this
            ->withHeaders($this->authHeaders($admin))
            ->getJson('/api/super-admin/audit-logs')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.0.action', 'super_admin.tested');
    }
}
