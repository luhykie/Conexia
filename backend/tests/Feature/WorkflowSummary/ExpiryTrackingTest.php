<?php

namespace Tests\Feature\WorkflowSummary;

use App\Models\Document;
use App\Models\Profile;
use Illuminate\Support\Carbon;
use Tests\Feature\Support\SecurityTestCase;

class ExpiryTrackingTest extends SecurityTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-07-27 09:00:00');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_document_without_expiry_date_is_valid(): void
    {
        $department = $this->department();
        $staff = $this->profile(Profile::ROLE_DEPARTMENT_STAFF, [
            'department_id' => $department->id,
        ]);

        $this->postJson(
            '/api/department/documents',
            [
                'tracking_number' => 'NO-EXPIRY',
                'title' => 'No Expiry Agreement',
                'document_type' => 'MOA',
                'partner_institution' => 'Partner',
            ],
            $this->authHeaders($staff)
        )
            ->assertOk()
            ->assertJsonPath(
                'document.renewal_status',
                Document::RENEWAL_NOT_REQUIRED
            )
            ->assertJsonPath('document.expiry_date', null);
    }

    public function test_valid_effective_and_expiry_dates_are_saved(): void
    {
        $department = $this->department();
        $staff = $this->profile(Profile::ROLE_DEPARTMENT_STAFF, [
            'department_id' => $department->id,
        ]);

        $this->postJson(
            '/api/department/documents',
            [
                'tracking_number' => 'VALID-EXPIRY',
                'title' => 'Valid Expiry Agreement',
                'document_type' => 'MOA',
                'partner_institution' => 'Partner',
                'effective_date' => '2026-07-27',
                'expiry_date' => '2027-07-27',
                'renewal_notice_days' => 45,
            ],
            $this->authHeaders($staff)
        )
            ->assertOk()
            ->assertJsonPath('document.effective_date', '2026-07-27')
            ->assertJsonPath('document.expiry_date', '2027-07-27')
            ->assertJsonPath('document.renewal_notice_days', 45)
            ->assertJsonPath(
                'document.renewal_status',
                Document::RENEWAL_ACTIVE
            );
    }

    public function test_expiry_date_before_effective_date_returns_422(): void
    {
        $department = $this->department();
        $staff = $this->profile(Profile::ROLE_DEPARTMENT_STAFF, [
            'department_id' => $department->id,
        ]);

        $this->postJson(
            '/api/department/documents',
            [
                'tracking_number' => 'BAD-EXPIRY',
                'title' => 'Bad Expiry Agreement',
                'document_type' => 'MOA',
                'partner_institution' => 'Partner',
                'effective_date' => '2026-07-27',
                'expiry_date' => '2026-07-26',
            ],
            $this->authHeaders($staff)
        )->assertUnprocessable();
    }

    public function test_expiring_soon_uses_default_notice_period(): void
    {
        $department = $this->department();
        $staff = $this->profile(Profile::ROLE_DEPARTMENT_STAFF, [
            'department_id' => $department->id,
        ]);
        $document = $this->document([
            'department_id' => $department->id,
            'submitted_by' => $staff->id,
            'expiry_date' => '2026-08-20',
            'renewal_status' => Document::RENEWAL_ACTIVE,
        ]);

        $this->getJson('/api/expiry', $this->authHeaders($staff))
            ->assertOk()
            ->assertJsonPath('data.stats.total_expiring_soon', 1)
            ->assertJsonPath('data.records.0.id', $document->id)
            ->assertJsonPath(
                'data.records.0.classification',
                'expiring_soon'
            );
    }

    public function test_custom_notice_period_controls_expiring_soon(): void
    {
        $department = $this->department();
        $staff = $this->profile(Profile::ROLE_DEPARTMENT_STAFF, [
            'department_id' => $department->id,
        ]);

        $this->document([
            'department_id' => $department->id,
            'expiry_date' => '2026-09-10',
            'renewal_notice_days' => 60,
            'renewal_status' => Document::RENEWAL_ACTIVE,
        ]);

        $this->getJson('/api/expiry', $this->authHeaders($staff))
            ->assertOk()
            ->assertJsonPath('data.stats.total_expiring_soon', 1);
    }

    public function test_expired_classification(): void
    {
        $department = $this->department();
        $staff = $this->profile(Profile::ROLE_DEPARTMENT_STAFF, [
            'department_id' => $department->id,
        ]);

        $this->document([
            'department_id' => $department->id,
            'expiry_date' => '2026-07-01',
            'renewal_status' => Document::RENEWAL_ACTIVE,
        ]);

        $this->getJson('/api/expiry', $this->authHeaders($staff))
            ->assertOk()
            ->assertJsonPath('data.stats.expired', 1)
            ->assertJsonPath(
                'data.records.0.classification',
                'expired'
            );
    }

    public function test_expiry_scoping_and_role_rules(): void
    {
        $ownDepartment = $this->department(['code' => 'OWN']);
        $otherDepartment = $this->department(['code' => 'OTH']);
        $staff = $this->profile(Profile::ROLE_DEPARTMENT_STAFF, [
            'department_id' => $ownDepartment->id,
        ]);
        $legal = $this->profile(Profile::ROLE_LEGAL_COUNSEL);
        $iro = $this->profile(Profile::ROLE_IRO_STAFF);
        $superAdmin = $this->profile(Profile::ROLE_SUPER_ADMIN);

        $own = $this->document([
            'department_id' => $ownDepartment->id,
            'expiry_date' => '2026-08-01',
            'renewal_status' => Document::RENEWAL_ACTIVE,
        ]);
        $this->document([
            'department_id' => $otherDepartment->id,
            'expiry_date' => '2026-08-01',
            'renewal_status' => Document::RENEWAL_ACTIVE,
        ]);
        $legalDocument = $this->document([
            'assigned_legal_counsel' => $legal->id,
            'expiry_date' => '2026-08-01',
            'renewal_status' => Document::RENEWAL_ACTIVE,
        ]);

        $staffResponse = $this->getJson(
            '/api/expiry',
            $this->authHeaders($staff)
        )->assertOk();

        $staffResponse->assertJsonFragment(['id' => $own->id]);
        $staffResponse->assertJsonMissing([
            'id' => $legalDocument->id,
        ]);

        $this->getJson('/api/expiry', $this->authHeaders($legal))
            ->assertOk()
            ->assertJsonFragment(['id' => $legalDocument->id]);

        $this->getJson('/api/expiry', $this->authHeaders($iro))
            ->assertOk()
            ->assertJsonPath('data.stats.total_expiring_soon', 3)
            ->assertJsonMissingPath('data.records.0.partner_institution')
            ->assertJsonMissingPath('data.records.0.title')
            ->assertJsonMissingPath('data.records.0.document_type');

        $this->getJson('/api/expiry', $this->authHeaders($superAdmin))
            ->assertForbidden();
    }

    public function test_expiry_notifications_are_not_duplicated(): void
    {
        $department = $this->department();
        $staff = $this->profile(Profile::ROLE_DEPARTMENT_STAFF, [
            'department_id' => $department->id,
        ]);
        $document = $this->document([
            'department_id' => $department->id,
            'submitted_by' => $staff->id,
            'expiry_date' => '2026-08-01',
            'renewal_status' => Document::RENEWAL_ACTIVE,
        ]);

        $this->artisan('conexia:sync-expiry-notifications')
            ->assertSuccessful();
        $this->artisan('conexia:sync-expiry-notifications')
            ->assertSuccessful();

        $this->assertDatabaseCount('notifications', 1);
        $this->assertDatabaseHas('notifications', [
            'document_id' => $document->id,
            'notification_type' => 'document_expiring_soon',
        ]);
    }

    public function test_renewal_request_records_audit_log(): void
    {
        $department = $this->department();
        $staff = $this->profile(Profile::ROLE_DEPARTMENT_STAFF, [
            'department_id' => $department->id,
        ]);
        $document = $this->document([
            'department_id' => $department->id,
            'expiry_date' => '2026-08-01',
            'renewal_status' => Document::RENEWAL_ACTIVE,
        ]);

        $this->patchJson(
            "/api/expiry/documents/{$document->id}/renewal-request",
            [],
            $this->authHeaders($staff)
        )
            ->assertOk()
            ->assertJsonPath(
                'data.renewal_status',
                Document::RENEWAL_REQUESTED
            );

        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => $staff->id,
            'document_id' => $document->id,
            'action' => 'document_renewal.requested',
        ]);
    }
}
