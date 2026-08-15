<?php

namespace Tests\Feature\Dashboard;

use App\Models\Document;
use App\Models\Profile;
use Tests\Feature\Support\SecurityTestCase;

class DashboardAuthorizationTest extends SecurityTestCase
{
    public function test_dashboard_routes_reject_unauthenticated_requests(): void
    {
        $this->getJson('/api/department/dashboard')
            ->assertUnauthorized();
    }

    public function test_department_dashboard_denies_wrong_role(): void
    {
        $legal = $this->profile(Profile::ROLE_LEGAL_COUNSEL);

        $this->getJson(
            '/api/department/dashboard',
            $this->authHeaders($legal)
        )->assertForbidden();
    }

    public function test_department_dashboard_is_scoped_to_users_department(): void
    {
        $ownDepartment = $this->department(['code' => 'SCS']);
        $otherDepartment = $this->department(['code' => 'SBM']);
        $staff = $this->profile(Profile::ROLE_DEPARTMENT_STAFF, [
            'department_id' => $ownDepartment->id,
        ]);

        $this->document([
            'department_id' => $ownDepartment->id,
            'status' => Document::STATUS_SUBMITTED,
        ]);
        $this->document([
            'department_id' => $ownDepartment->id,
            'status' => Document::STATUS_CORRECTIONS_NEEDED,
        ]);
        $this->document([
            'department_id' => $otherDepartment->id,
            'status' => Document::STATUS_SUBMITTED,
        ]);

        $this->getJson(
            '/api/department/dashboard',
            $this->authHeaders($staff)
        )
            ->assertOk()
            ->assertJsonPath('data.stats.active_submissions', 1)
            ->assertJsonPath('data.stats.pending_corrections', 1);
    }

    public function test_iro_dashboard_allows_iro_roles_and_denies_department_staff(): void
    {
        $iroStaff = $this->profile(Profile::ROLE_IRO_STAFF);
        $iroAdmin = $this->profile(Profile::ROLE_IRO_ADMIN);
        $departmentStaff = $this->profile(
            Profile::ROLE_DEPARTMENT_STAFF
        );

        $this->getJson(
            '/api/iro/dashboard',
            $this->authHeaders($iroStaff)
        )->assertOk();

        $this->getJson(
            '/api/iro/dashboard',
            $this->authHeaders($iroAdmin)
        )->assertOk();

        $this->getJson(
            '/api/iro/dashboard',
            $this->authHeaders($departmentStaff)
        )->assertForbidden();
    }

    public function test_iro_dashboard_returns_live_workflow_counts(): void
    {
        $iroStaff = $this->profile(Profile::ROLE_IRO_STAFF);
        $department = $this->department(['code' => 'SCS']);

        $this->document([
            'status' => Document::STATUS_UNDER_LEGAL_REVIEW,
        ]);
        $this->document([
            'status' => Document::STATUS_PENDING_NOTARIZATION,
        ]);
        $this->document([
            'status' => Document::STATUS_SUBMITTED,
            'department_id' => $department->id,
            'title' => 'Restricted Title',
            'document_type' => 'MOA',
            'partner_institution' => 'Restricted Partner',
        ]);
        $this->document(['status' => Document::STATUS_ARCHIVED]);

        $this->getJson(
            '/api/iro/dashboard',
            $this->authHeaders($iroStaff)
        )
            ->assertOk()
            ->assertJsonPath('data.stats.incoming_submissions', 1)
            ->assertJsonPath('data.stats.under_review', 1)
            ->assertJsonPath('data.stats.pending_notarization', 1)
            ->assertJsonPath('data.stats.archived', 1)
            ->assertJsonFragment([
                'entity_name' => 'SCS',
                'type' => 'MOA',
            ])
            ->assertJsonMissingPath('data.recent_activity.0.partner_institution')
            ->assertJsonMissingPath('data.recent_activity.0.document_type');
    }

    public function test_iro_admin_recent_activity_includes_stored_partnership_scope(): void
    {
        $iroAdmin = $this->profile(Profile::ROLE_IRO_ADMIN);
        $document = $this->document([
            'partnership_scope' => 'International',
        ]);

        $this->getJson(
            '/api/iro/dashboard',
            $this->authHeaders($iroAdmin)
        )
            ->assertOk()
            ->assertJsonPath(
                'data.recent_activity.0.tracking_number',
                $document->tracking_number
            )
            ->assertJsonPath(
                'data.recent_activity.0.partnership_scope',
                'International'
            );
    }

    public function test_legal_dashboard_is_scoped_to_assigned_counsel(): void
    {
        $legal = $this->profile(Profile::ROLE_LEGAL_COUNSEL);
        $otherLegal = $this->profile(Profile::ROLE_LEGAL_COUNSEL);

        $this->document([
            'assigned_legal_counsel' => $legal->id,
            'status' => Document::STATUS_UNDER_LEGAL_REVIEW,
        ]);
        $this->document([
            'assigned_legal_counsel' => $otherLegal->id,
            'status' => Document::STATUS_UNDER_LEGAL_REVIEW,
        ]);

        $this->getJson(
            '/api/legal/dashboard',
            $this->authHeaders($legal)
        )
            ->assertOk()
            ->assertJsonPath('data.stats.pending_legal_reviews', 1);
    }

    public function test_super_admin_dashboard_is_governance_only(): void
    {
        $superAdmin = $this->profile(Profile::ROLE_SUPER_ADMIN);
        $this->profile(Profile::ROLE_IRO_STAFF);
        $this->department(['code' => 'SCS']);
        $this->document([
            'partner_institution' => 'Forbidden Partner',
            'title' => 'Forbidden Document Title',
            'legal_notes' => 'Forbidden legal notes',
        ]);

        $response = $this->getJson(
            '/api/super-admin/dashboard',
            $this->authHeaders($superAdmin)
        )
            ->assertOk()
            ->assertJsonPath('data.stats.totalUsers', 2)
            ->assertJsonPath('data.stats.activeUsers', 2)
            ->assertJsonPath('data.stats.activeDepartments', 1);

        $payload = $response->getContent();

        $this->assertStringNotContainsString(
            'Forbidden Partner',
            $payload
        );
        $this->assertStringNotContainsString(
            'Forbidden Document Title',
            $payload
        );
        $this->assertStringNotContainsString(
            'Forbidden legal notes',
            $payload
        );
    }

    public function test_super_admin_dashboard_denies_document_roles(): void
    {
        $legal = $this->profile(Profile::ROLE_LEGAL_COUNSEL);

        $this->getJson(
            '/api/super-admin/dashboard',
            $this->authHeaders($legal)
        )->assertForbidden();
    }
}
