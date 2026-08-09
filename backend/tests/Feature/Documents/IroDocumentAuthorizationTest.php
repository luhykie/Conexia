<?php

namespace Tests\Feature\Documents;

use App\Models\AuditLog;
use App\Models\Document;
use App\Models\Profile;
use Tests\Feature\Support\SecurityTestCase;

class IroDocumentAuthorizationTest extends SecurityTestCase
{
    public function test_iro_incoming_route_excludes_archived_records(): void
    {
        $iro = $this->profile(Profile::ROLE_IRO_STAFF);

        $submitted = $this->document([
            'status' => Document::STATUS_SUBMITTED,
        ]);

        $archived = $this->document([
            'status' => Document::STATUS_ARCHIVED,
        ]);

        $response = $this->getJson(
            '/api/iro/documents/incoming',
            $this->authHeaders($iro)
        )->assertOk();

        $response->assertJsonFragment(['id' => $submitted->id]);
        $response->assertJsonMissing(['id' => $archived->id]);
        $response->assertJsonMissingPath('data.0.partner_institution');
        $response->assertJsonMissingPath('data.0.title');
        $response->assertJsonMissingPath('data.0.document_type');
        $response->assertJsonMissingPath('data.0.legal_notes');
    }

    public function test_iro_staff_cannot_perform_admin_workflow_actions(): void
    {
        $iro = $this->profile(Profile::ROLE_IRO_STAFF);
        $legal = $this->profile(Profile::ROLE_LEGAL_COUNSEL);
        $document = $this->document([
            'status' => Document::STATUS_SUBMITTED,
        ]);

        $this->patchJson(
            "/api/iro/documents/{$document->id}/log",
            [],
            $this->authHeaders($iro)
        )->assertForbidden();

        $this->patchJson(
            "/api/iro/documents/{$document->id}/assign-legal",
            ['legal_counsel_id' => $legal->id],
            $this->authHeaders($iro)
        )->assertForbidden();

        $this->patchJson(
            "/api/iro/documents/{$document->id}/archive",
            [],
            $this->authHeaders($iro)
        )->assertForbidden();

        $this->patchJson(
            "/api/iro/documents/{$document->id}/reassign-legal",
            [
                'destination_type' => 'legal_counsel',
                'destination_id' => $legal->id,
                'reason' => 'Workload balancing.',
            ],
            $this->authHeaders($iro)
        )->assertForbidden();

        $archived = $this->document([
            'status' => Document::STATUS_ARCHIVED,
            'assigned_legal_counsel' => $legal->id,
            'archived_at' => now(),
        ]);

        $this->patchJson(
            "/api/iro/documents/{$archived->id}/unarchive",
            [],
            $this->authHeaders($iro)
        )->assertForbidden();
    }

    public function test_iro_admin_can_log_submitted_document(): void
    {
        $iro = $this->profile(Profile::ROLE_IRO_ADMIN);
        $document = $this->document([
            'status' => Document::STATUS_SUBMITTED,
        ]);

        $this->patchJson(
            "/api/iro/documents/{$document->id}/log",
            [],
            $this->authHeaders($iro)
        )
            ->assertOk()
            ->assertJsonPath('document.status', Document::STATUS_LOGGED);
    }

    public function test_iro_mutation_rejects_invalid_workflow_status(): void
    {
        $iro = $this->profile(Profile::ROLE_IRO_ADMIN);
        $document = $this->document([
            'status' => Document::STATUS_APPROVED,
        ]);

        $this->patchJson(
            "/api/iro/documents/{$document->id}/log",
            [],
            $this->authHeaders($iro)
        )->assertUnprocessable();
    }

    public function test_non_iro_user_cannot_mutate_iro_documents(): void
    {
        $departmentUser = $this->profile(
            Profile::ROLE_DEPARTMENT_STAFF
        );

        $document = $this->document([
            'status' => Document::STATUS_SUBMITTED,
        ]);

        $this->patchJson(
            "/api/iro/documents/{$document->id}/log",
            [],
            $this->authHeaders($departmentUser)
        )->assertForbidden();
    }

    public function test_iro_admin_can_reassign_legal_counsel(): void
    {
        $iro = $this->profile(Profile::ROLE_IRO_ADMIN);
        $currentLegal = $this->profile(Profile::ROLE_LEGAL_COUNSEL);
        $newLegal = $this->profile(Profile::ROLE_LEGAL_COUNSEL);
        $document = $this->document([
            'status' => Document::STATUS_UNDER_LEGAL_REVIEW,
            'assigned_legal_counsel' => $currentLegal->id,
        ]);

        $this->patchJson(
            "/api/iro/documents/{$document->id}/reassign-legal",
            [
                'destination_type' => 'legal_counsel',
                'destination_id' => $newLegal->id,
                'reason' => 'Balancing assigned legal review work.',
            ],
            $this->authHeaders($iro)
        )
            ->assertOk()
            ->assertJsonPath(
                'document.assigned_legal_counsel',
                $newLegal->id
            )
            ->assertJsonPath(
                'document.status',
                Document::STATUS_UNDER_LEGAL_REVIEW
            );

        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => $iro->id,
            'document_id' => $document->id,
            'action' => 'iro_admin.document.reassigned',
        ]);

        $auditLog = AuditLog::query()
            ->where('document_id', $document->id)
            ->where('action', 'iro_admin.document.reassigned')
            ->firstOrFail();

        $this->assertSame(
            $currentLegal->id,
            $auditLog->metadata['previous_destination']['id']
        );
        $this->assertSame(
            $newLegal->id,
            $auditLog->metadata['new_destination']['id']
        );
        $this->assertSame(
            'Balancing assigned legal review work.',
            $auditLog->metadata['reason']
        );
    }

    public function test_iro_admin_reassignment_rejects_same_assignee(): void
    {
        $iro = $this->profile(Profile::ROLE_IRO_ADMIN);
        $legal = $this->profile(Profile::ROLE_LEGAL_COUNSEL);
        $document = $this->document([
            'status' => Document::STATUS_UNDER_LEGAL_REVIEW,
            'assigned_legal_counsel' => $legal->id,
        ]);

        $this->patchJson(
            "/api/iro/documents/{$document->id}/reassign-legal",
            [
                'destination_type' => 'legal_counsel',
                'destination_id' => $legal->id,
                'reason' => 'Same person should fail.',
            ],
            $this->authHeaders($iro)
        )->assertUnprocessable();
    }

    public function test_iro_admin_reassignment_rejects_ineligible_users(): void
    {
        $iro = $this->profile(Profile::ROLE_IRO_ADMIN);
        $inactiveLegal = $this->profile(Profile::ROLE_LEGAL_COUNSEL, [
            'is_active' => false,
        ]);
        $departmentUser = $this->profile(Profile::ROLE_DEPARTMENT_STAFF);
        $document = $this->document([
            'status' => Document::STATUS_UNDER_LEGAL_REVIEW,
        ]);

        $this->patchJson(
            "/api/iro/documents/{$document->id}/reassign-legal",
            [
                'destination_type' => 'legal_counsel',
                'destination_id' => $inactiveLegal->id,
                'reason' => 'Inactive user should fail.',
            ],
            $this->authHeaders($iro)
        )->assertUnprocessable();

        $this->patchJson(
            "/api/iro/documents/{$document->id}/reassign-legal",
            [
                'destination_type' => 'legal_counsel',
                'destination_id' => $departmentUser->id,
                'reason' => 'Wrong role should fail.',
            ],
            $this->authHeaders($iro)
        )->assertUnprocessable();
    }

    public function test_iro_admin_gets_dynamic_departmental_reassignment_destinations(): void
    {
        $iro = $this->profile(Profile::ROLE_IRO_ADMIN);
        $scs = $this->department([
            'code' => 'SCS',
            'name' => 'School of Computer Studies',
        ]);
        $sbm = $this->department([
            'code' => 'SBM',
            'name' => 'School of Business and Management',
        ]);
        $sea = $this->department([
            'code' => 'SEA',
            'name' => 'School of Engineering and Architecture',
        ]);
        $legal = $this->profile(Profile::ROLE_LEGAL_COUNSEL);
        $document = $this->document([
            'department_id' => $scs->id,
            'partner_institution' => 'SBM - School of Business and Management',
            'status' => Document::STATUS_LOGGED,
        ]);

        $response = $this->getJson(
            '/api/iro/documents/status?per_page=100',
            $this->authHeaders($iro)
        )->assertOk();

        $response->assertJsonFragment([
            'key' => 'department:'.$scs->id,
            'label' => 'SCS - School of Computer Studies',
        ]);
        $response->assertJsonFragment([
            'key' => 'department:'.$sbm->id,
            'label' => 'SBM - School of Business and Management',
        ]);
        $response->assertJsonFragment([
            'key' => 'legal_counsel:'.$legal->id,
            'category' => 'Legal Counsel',
        ]);
        $response->assertJsonMissing([
            'key' => 'department:'.$sea->id,
        ]);

        $this->patchJson(
            "/api/iro/documents/{$document->id}/reassign-legal",
            [
                'destination_type' => 'department',
                'destination_id' => $sbm->id,
                'reason' => 'Route back to the involved partner department.',
            ],
            $this->authHeaders($iro)
        )->assertOk();

        $auditLog = AuditLog::query()
            ->where('document_id', $document->id)
            ->where('action', 'iro_admin.document.reassigned')
            ->firstOrFail();

        $this->assertSame(
            $sbm->id,
            $auditLog->metadata['new_destination']['id']
        );
        $this->assertSame($iro->id, $auditLog->actor_id);

        $this->patchJson(
            "/api/iro/documents/{$document->id}/reassign-legal",
            [
                'destination_type' => 'department',
                'destination_id' => $sea->id,
                'reason' => 'Unrelated departments should be rejected.',
            ],
            $this->authHeaders($iro)
        )->assertUnprocessable();
    }

    public function test_iro_admin_can_reassign_to_local_partner_destination(): void
    {
        $iro = $this->profile(Profile::ROLE_IRO_ADMIN);
        $scs = $this->department([
            'code' => 'SCS',
            'name' => 'School of Computer Studies',
        ]);
        $document = $this->document([
            'department_id' => $scs->id,
            'partner_institution' => 'Ayala Mall Company',
            'partner_email' => 'contact@ayala.ph',
            'status' => Document::STATUS_LOGGED,
        ]);

        $this->patchJson(
            "/api/iro/documents/{$document->id}/reassign-legal",
            [
                'destination_type' => 'partner',
                'destination_id' => null,
                'reason' => 'Route to local partner for follow-up.',
            ],
            $this->authHeaders($iro)
        )->assertOk();

        $auditLog = AuditLog::query()
            ->where('document_id', $document->id)
            ->where('action', 'iro_admin.document.reassigned')
            ->firstOrFail();

        $this->assertSame(
            'Ayala Mall Company',
            $auditLog->metadata['new_destination']['label']
        );
        $this->assertSame(
            'Local Partner',
            $auditLog->metadata['new_destination']['category']
        );
    }

    public function test_iro_admin_can_reassign_to_international_partner_destination(): void
    {
        $iro = $this->profile(Profile::ROLE_IRO_ADMIN);
        $scs = $this->department([
            'code' => 'SCS',
            'name' => 'School of Computer Studies',
        ]);
        $document = $this->document([
            'department_id' => $scs->id,
            'partner_institution' => 'Global Tech University',
            'partner_email' => 'contact@global.edu',
            'status' => Document::STATUS_LOGGED,
        ]);

        $this->patchJson(
            "/api/iro/documents/{$document->id}/reassign-legal",
            [
                'destination_type' => 'partner',
                'destination_id' => null,
                'reason' => 'Route to international partner for follow-up.',
            ],
            $this->authHeaders($iro)
        )->assertOk();

        $auditLog = AuditLog::query()
            ->where('document_id', $document->id)
            ->where('action', 'iro_admin.document.reassigned')
            ->firstOrFail();

        $this->assertSame(
            'Global Tech University',
            $auditLog->metadata['new_destination']['label']
        );
        $this->assertSame(
            'International Partner',
            $auditLog->metadata['new_destination']['category']
        );
    }

    public function test_iro_admin_reassignment_rejects_terminal_statuses(): void
    {
        $iro = $this->profile(Profile::ROLE_IRO_ADMIN);
        $legal = $this->profile(Profile::ROLE_LEGAL_COUNSEL);

        foreach ([Document::STATUS_NOTARIZED, Document::STATUS_ARCHIVED] as $status) {
            $document = $this->document([
                'status' => $status,
                'archived_at' => $status === Document::STATUS_ARCHIVED
                    ? now()
                    : null,
            ]);

            $this->patchJson(
                "/api/iro/documents/{$document->id}/reassign-legal",
                [
                    'destination_type' => 'legal_counsel',
                    'destination_id' => $legal->id,
                    'reason' => 'Terminal records should be rejected.',
                ],
                $this->authHeaders($iro)
            )->assertUnprocessable();
        }
    }

    public function test_iro_admin_can_unarchive_document(): void
    {
        $iro = $this->profile(Profile::ROLE_IRO_ADMIN);
        $trackingNumber = 'CONEXIA-20260810-0001';
        $document = $this->document([
            'tracking_number' => $trackingNumber,
            'status' => Document::STATUS_ARCHIVED,
            'archived_at' => now(),
            'archived_by' => $iro->id,
        ]);

        $this->patchJson(
            "/api/iro/documents/{$document->id}/unarchive",
            [],
            $this->authHeaders($iro)
        )
            ->assertOk()
            ->assertJsonPath('document.status', Document::STATUS_NOTARIZED)
            ->assertJsonPath('document.tracking_number', $trackingNumber);

        $this->assertDatabaseHas('documents', [
            'id' => $document->id,
            'tracking_number' => $trackingNumber,
            'status' => Document::STATUS_NOTARIZED,
            'archived_at' => null,
            'archived_by' => null,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => $iro->id,
            'document_id' => $document->id,
            'action' => 'iro_admin.document.unarchived',
        ]);
    }

    public function test_department_staff_can_load_department_dropdown_source(): void
    {
        $departments = [
            ['code' => 'SBM', 'name' => 'School of Business and Management'],
            ['code' => 'SEA', 'name' => 'School of Engineering and Architecture'],
            ['code' => 'SAS', 'name' => 'School of Arts and Sciences'],
            ['code' => 'SAMS', 'name' => 'School of Allied Medical Sciences'],
            ['code' => 'SCS', 'name' => 'School of Computer Studies'],
            ['code' => 'SED', 'name' => 'School of Education'],
            ['code' => 'SOL', 'name' => 'School of Law'],
            [
                'code' => 'ETEEAP',
                'name' => 'Expanded Tertiary Education Equivalency and Accreditation Program',
            ],
        ];

        foreach ($departments as $departmentData) {
            $this->department($departmentData);
        }

        $department = \App\Models\Department::query()
            ->where('code', 'SCS')
            ->firstOrFail();
        $departmentUser = $this->profile(
            Profile::ROLE_DEPARTMENT_STAFF,
            ['department_id' => $department->id]
        );

        $this->getJson(
            '/api/departments?per_page=100&sort=code&direction=asc',
            $this->authHeaders($departmentUser)
        )
            ->assertOk()
            ->assertJsonCount(8, 'data')
            ->assertJsonFragment(['code' => 'SCS'])
            ->assertJsonFragment(['code' => 'ETEEAP']);
    }
}
