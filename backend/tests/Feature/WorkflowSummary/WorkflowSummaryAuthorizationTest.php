<?php

namespace Tests\Feature\WorkflowSummary;

use App\Models\Document;
use App\Models\Profile;
use Tests\Feature\Support\SecurityTestCase;

class WorkflowSummaryAuthorizationTest extends SecurityTestCase
{
    public function test_expiry_requires_authentication(): void
    {
        $this->getJson('/api/expiry')
            ->assertUnauthorized();
    }

    public function test_expiry_denies_super_admin(): void
    {
        $superAdmin = $this->profile(Profile::ROLE_SUPER_ADMIN);

        $this->getJson(
            '/api/expiry',
            $this->authHeaders($superAdmin)
        )->assertForbidden();
    }

    public function test_department_staff_can_load_scoped_expiry_structure(): void
    {
        $department = $this->department();
        $staff = $this->profile(Profile::ROLE_DEPARTMENT_STAFF, [
            'department_id' => $department->id,
        ]);

        $this->document([
            'department_id' => $department->id,
            'status' => Document::STATUS_APPROVED,
        ]);

        $this->getJson(
            '/api/expiry',
            $this->authHeaders($staff)
        )
            ->assertOk()
            ->assertJsonPath('data.stats.total_expiring_soon', 0)
            ->assertJsonPath('data.records', []);
    }

    public function test_archive_endpoint_is_iro_admin_only(): void
    {
        $iroAdmin = $this->profile(Profile::ROLE_IRO_ADMIN);
        $iroStaff = $this->profile(Profile::ROLE_IRO_STAFF);

        $this->getJson(
            '/api/iro/archive',
            $this->authHeaders($iroAdmin)
        )->assertOk();

        $this->getJson(
            '/api/iro/archive',
            $this->authHeaders($iroStaff)
        )->assertForbidden();
    }

    public function test_archive_endpoint_returns_only_archived_records(): void
    {
        $iroAdmin = $this->profile(Profile::ROLE_IRO_ADMIN);

        $archived = $this->document([
            'tracking_number' => 'ARCHIVED-001',
            'status' => Document::STATUS_ARCHIVED,
            'archived_at' => now(),
        ]);

        $this->document([
            'tracking_number' => 'NOTARIZED-001',
            'status' => Document::STATUS_NOTARIZED,
        ]);

        $response = $this->getJson(
            '/api/iro/archive',
            $this->authHeaders($iroAdmin)
        )
            ->assertOk()
            ->assertJsonPath('data.stats.total_archived', 1)
            ->assertJsonPath('data.stats.pending_archival', 1);

        $payload = $response->getContent();

        $this->assertStringContainsString(
            $archived->tracking_number,
            $payload
        );
        $this->assertStringNotContainsString(
            'NOTARIZED-001',
            $payload
        );
    }

    public function test_reports_endpoint_returns_computed_values(): void
    {
        $iroAdmin = $this->profile(Profile::ROLE_IRO_ADMIN);
        $department = $this->department(['code' => 'SCS']);

        $this->document([
            'department_id' => $department->id,
            'status' => Document::STATUS_APPROVED,
        ]);
        $this->document([
            'department_id' => $department->id,
            'status' => Document::STATUS_CORRECTIONS_NEEDED,
        ]);
        $this->document([
            'department_id' => $department->id,
            'status' => Document::STATUS_NOTARIZED,
        ]);

        $this->getJson(
            '/api/iro/reports',
            $this->authHeaders($iroAdmin)
        )
            ->assertOk()
            ->assertJsonPath('data.stats.total_reviewed', 3)
            ->assertJsonPath('data.stats.total_returned', 1)
            ->assertJsonPath('data.stats.total_notarized', 1)
            ->assertJsonPath(
                'data.department_breakdown.0.total_requests',
                3
            );
    }

    public function test_reports_endpoint_denies_wrong_role(): void
    {
        $departmentStaff = $this->profile(
            Profile::ROLE_DEPARTMENT_STAFF
        );

        $this->getJson(
            '/api/iro/reports',
            $this->authHeaders($departmentStaff)
        )->assertForbidden();
    }

    public function test_notification_archive_returns_only_own_notifications(): void
    {
        $staff = $this->profile(Profile::ROLE_DEPARTMENT_STAFF);
        $otherStaff = $this->profile(Profile::ROLE_DEPARTMENT_STAFF);

        $own = $this->notification([
            'user_id' => $staff->id,
            'message' => 'Own notification',
        ]);

        $this->notification([
            'user_id' => $otherStaff->id,
            'message' => 'Other notification',
        ]);

        $response = $this->getJson(
            '/api/notifications',
            $this->authHeaders($staff)
        )
            ->assertOk()
            ->assertJsonPath('data.0.id', $own->id);

        $payload = $response->getContent();

        $this->assertStringContainsString(
            'Own notification',
            $payload
        );
        $this->assertStringNotContainsString(
            'Other notification',
            $payload
        );
    }
}
