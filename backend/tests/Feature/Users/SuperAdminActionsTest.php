<?php

namespace Tests\Feature\Users;

use App\Models\AuditLog;
use App\Models\Profile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
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

    public function test_super_admin_can_create_non_department_user_without_department(): void
    {
        $admin = $this->profile(Profile::ROLE_SUPER_ADMIN);
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
                'full_name' => 'New Legal Counsel',
                'email' => 'new.legal@conexia.test',
                'role' => Profile::ROLE_LEGAL_COUNSEL,
                'department_id' => null,
                'is_active' => true,
            ]);

        $response->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('user.id', $supabaseUserId)
            ->assertJsonPath('user.department', null)
            ->assertJsonPath('user.departmentCode', null)
            ->assertJsonPath('user.departmentName', null);
    }

    public function test_non_duplicate_supabase_validation_failure_is_not_reported_as_email_duplicate(): void
    {
        $admin = $this->profile(Profile::ROLE_SUPER_ADMIN);
        $department = $this->department();

        config([
            'supabase.url' => 'https://conexia-test.supabase.co',
            'supabase.service_role_key' => 'service-role-test',
        ]);

        Http::fake([
            '*/auth/v1/admin/users' => Http::response([
                'code' => 'password_too_short',
                'msg' => 'Password should be at least 6 characters.',
            ], 422),
        ]);

        $response = $this
            ->withHeaders($this->authHeaders($admin))
            ->postJson('/api/users', [
                'full_name' => 'Rejected User',
                'email' => 'rejected.user@conexia.test',
                'role' => Profile::ROLE_DEPARTMENT_STAFF,
                'department_id' => $department->id,
                'is_active' => true,
            ]);

        $response->assertStatus(502)
            ->assertJsonPath('message', 'Unable to create the Supabase Auth user.');

        $this->assertDatabaseMissing('profiles', [
            'email' => 'rejected.user@conexia.test',
        ]);
    }

    public function test_super_admin_can_delete_and_immediately_recreate_user_with_same_email(): void
    {
        $admin = $this->profile(Profile::ROLE_SUPER_ADMIN);
        $department = $this->department();
        Schema::create('document_discussion_messages', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('author_id');
        });
        $firstSupabaseUserId = (string) Str::uuid();
        $secondSupabaseUserId = (string) Str::uuid();
        $deleteChecks = 0;
        $createCalls = 0;

        config([
            'supabase.url' => 'https://conexia-test.supabase.co',
            'supabase.service_role_key' => 'service-role-test',
        ]);

        Http::fake(function ($request) use (
            &$deleteChecks,
            &$createCalls,
            $firstSupabaseUserId,
            $secondSupabaseUserId
        ) {
            if ($request->method() === 'POST') {
                $createCalls++;

                return Http::response([
                    'id' => $createCalls === 1
                        ? $firstSupabaseUserId
                        : $secondSupabaseUserId,
                ], 200);
            }

            if ($request->method() === 'DELETE') {
                return Http::response([], 204);
            }

            $deleteChecks++;

            return $deleteChecks === 1
                ? Http::response(['id' => $firstSupabaseUserId], 200)
                : Http::response([], 404);
        });

        $payload = [
            'full_name' => 'Reusable Demo User',
            'email' => 'reusable.demo@conexia.test',
            'role' => Profile::ROLE_DEPARTMENT_STAFF,
            'department_id' => $department->id,
            'is_active' => true,
        ];

        $this->withHeaders($this->authHeaders($admin))
            ->postJson('/api/users', $payload)
            ->assertCreated();

        $createdProfile = Profile::query()
            ->where('email', $payload['email'])
            ->firstOrFail();

        $this->withHeaders($this->authHeaders($admin))
            ->deleteJson("/api/users/{$createdProfile->id}")
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('profiles', ['email' => $payload['email']]);
        $this->assertSame(2, $deleteChecks);

        $this->withHeaders($this->authHeaders($admin))
            ->postJson('/api/users', $payload)
            ->assertCreated()
            ->assertJsonPath('user.id', $secondSupabaseUserId);
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

    public function test_super_admin_can_change_permissions_that_were_previously_protected(): void
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
            ->assertOk()
            ->assertJsonPath('success', true);
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
