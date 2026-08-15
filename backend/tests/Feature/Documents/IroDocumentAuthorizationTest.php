<?php

namespace Tests\Feature\Documents;

use App\Models\AuditLog;
use App\Models\Document;
use App\Models\Profile;
use Illuminate\Support\Carbon;
use Tests\Feature\Support\SecurityTestCase;

class IroDocumentAuthorizationTest extends SecurityTestCase
{
    public function test_iro_admin_must_submit_a_responsible_office_and_it_is_visible_to_iro_staff(): void
    {
        $admin = $this->profile(Profile::ROLE_IRO_ADMIN);
        $staff = $this->profile(Profile::ROLE_IRO_STAFF);
        $department = $this->department([
            'code' => 'PAIR-EXT',
            'name' => 'External Relations Office',
        ]);
        $payload = [
            'title' => 'Office-owned agreement',
            'document_type' => 'MOA',
            'partner_institution' => 'Partner University',
            'description' => 'Agreement with a responsible office.',
            'partnership_type' => 'New Partnership',
            'partnership_scope' => 'International',
            'contact_person' => 'Alex Partner',
            'contact_email' => 'alex@example.test',
            'urgency' => 'Normal',
        ];

        $this->postJson(
            '/api/iro/documents',
            $payload,
            $this->authHeaders($admin)
        )->assertUnprocessable()->assertJsonValidationErrors('department_id');

        $documentId = $this->postJson(
            '/api/iro/documents',
            [...$payload, 'department_id' => $department->id],
            $this->authHeaders($admin)
        )
            ->assertOk()
            ->assertJsonPath('document.department_id', $department->id)
            ->assertJsonPath('document.department.code', 'PAIR-EXT')
            ->json('document.id');

        $this->getJson(
            '/api/iro/documents/incoming',
            $this->authHeaders($staff)
        )
            ->assertOk()
            ->assertJsonPath('documents.0.id', $documentId)
            ->assertJsonPath('documents.0.department_id', $department->id)
            ->assertJsonPath('documents.0.department.code', 'PAIR-EXT');
    }

    public function test_iro_admin_can_explicitly_select_pair_iro_when_no_department_applies(): void
    {
        $admin = $this->profile(Profile::ROLE_IRO_ADMIN);

        $this->postJson('/api/iro/documents', [
            'title' => 'PAIR-owned agreement',
            'document_type' => 'MOU',
            'department_id' => null,
            'partner_institution' => 'Partner Organization',
            'partnership_type' => 'New Partnership',
            'partnership_scope' => 'Local',
            'contact_person' => 'Jamie Partner',
            'contact_email' => 'jamie@example.test',
            'urgency' => 'Normal',
        ], $this->authHeaders($admin))
            ->assertOk()
            ->assertJsonPath('document.department_id', null)
            ->assertJsonPath('document.department', null);
    }

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

    public function test_iro_admin_incoming_queue_contains_only_logged_documents(): void
    {
        $iroAdmin = $this->profile(Profile::ROLE_IRO_ADMIN);
        $submitted = $this->document([
            'status' => Document::STATUS_SUBMITTED,
        ]);
        $logged = $this->document([
            'status' => Document::STATUS_LOGGED,
        ]);
        $underReview = $this->document([
            'status' => Document::STATUS_UNDER_LEGAL_REVIEW,
        ]);

        $response = $this->getJson(
            '/api/iro/documents/incoming',
            $this->authHeaders($iroAdmin)
        )
            ->assertOk()
            ->assertJsonCount(1, 'documents')
            ->assertJsonPath('documents.0.id', $logged->id)
            ->assertJsonPath('documents.0.status', Document::STATUS_LOGGED)
            ->assertJsonPath('meta.total', 1);

        $response->assertJsonMissing(['id' => $submitted->id]);
        $response->assertJsonMissing(['id' => $underReview->id]);

        $this->getJson(
            '/api/iro/documents/incoming?status=Submitted',
            $this->authHeaders($iroAdmin)
        )
            ->assertOk()
            ->assertJsonCount(0, 'documents')
            ->assertJsonPath('meta.total', 0);
    }

    public function test_iro_admin_can_filter_review_queue_by_first_time_and_revised_documents(): void
    {
        $iroAdmin = $this->profile(Profile::ROLE_IRO_ADMIN);
        $firstTime = $this->document([
            'status' => Document::STATUS_LOGGED,
        ]);
        $revised = $this->document([
            'status' => Document::STATUS_LOGGED,
        ]);
        $notReviewable = $this->document([
            'status' => Document::STATUS_CORRECTIONS_NEEDED,
        ]);

        AuditLog::query()->create([
            'actor_id' => $iroAdmin->id,
            'document_id' => $revised->id,
            'action' => 'iro_admin.review.returned_for_revision',
            'metadata' => [],
        ]);
        AuditLog::query()->create([
            'actor_id' => $iroAdmin->id,
            'document_id' => $notReviewable->id,
            'action' => 'iro_admin.review.returned_for_revision',
            'metadata' => [],
        ]);

        $all = $this->getJson(
            '/api/iro/documents/incoming',
            $this->authHeaders($iroAdmin)
        )->assertOk()->assertJsonPath('meta.total', 2);
        $all->assertJsonFragment([
            'id' => $firstTime->id,
            'review_status' => Document::STATUS_LOGGED,
        ]);
        $all->assertJsonFragment([
            'id' => $revised->id,
            'review_status' => 'Revised',
        ]);
        $all->assertJsonMissing(['id' => $notReviewable->id]);

        $this->getJson(
            '/api/iro/documents/incoming?status=Logged',
            $this->authHeaders($iroAdmin)
        )
            ->assertOk()
            ->assertJsonCount(1, 'documents')
            ->assertJsonPath('documents.0.id', $firstTime->id)
            ->assertJsonPath('documents.0.review_status', 'Logged');

        $this->getJson(
            '/api/iro/documents/incoming?status=Revised',
            $this->authHeaders($iroAdmin)
        )
            ->assertOk()
            ->assertJsonCount(1, 'documents')
            ->assertJsonPath('documents.0.id', $revised->id)
            ->assertJsonPath('documents.0.review_status', 'Revised');
    }

    public function test_iro_staff_can_view_submission_details(): void
    {
        $iro = $this->profile(Profile::ROLE_IRO_STAFF);
        $creator = $this->profile(Profile::ROLE_IRO_ADMIN, [
            'full_name' => 'Alex Admin',
            'email' => 'alex.admin@example.com',
        ]);
        $department = $this->department(['code' => 'TST']);
        $document = $this->document([
            'department_id' => $department->id,
            'submitted_by' => $creator->id,
            'status' => Document::STATUS_SUBMITTED,
            'document_type' => 'MOA',
            'partner_institution' => 'ABC University',
            'description' => 'Detailed review request.',
            'partnership_type' => 'Departmental',
            'partnership_scope' => 'Local',
            'contact_person' => 'Jane Doe',
            'contact_email' => 'jane@example.com',
        ]);

        $response = $this->getJson(
            "/api/iro/documents/{$document->id}",
            $this->authHeaders($iro)
        )->assertOk();

        $response->assertJsonPath('document.id', $document->id)
            ->assertJsonPath('document.document_type', 'MOA')
            ->assertJsonPath('document.partner_institution', 'ABC University')
            ->assertJsonPath('document.partnership_type', 'Departmental')
            ->assertJsonPath('document.partnership_scope', 'Local')
            ->assertJsonPath('document.contact_person', 'Jane Doe')
            ->assertJsonPath('document.department.code', 'TST')
            ->assertJsonPath('document.created_by.id', $creator->id)
            ->assertJsonPath('document.created_by.full_name', 'Alex Admin')
            ->assertJsonPath('document.created_by.role', Profile::ROLE_IRO_ADMIN);
    }

    public function test_incoming_filters_and_statistics_use_all_matching_documents(): void
    {
        Carbon::setTestNow('2026-08-12 12:00:00');

        try {
            $iro = $this->profile(Profile::ROLE_IRO_STAFF);
            $department = $this->department([
                'code' => 'ENG',
                'name' => 'Engineering',
            ]);
            $matching = $this->document([
                'department_id' => $department->id,
                'status' => Document::STATUS_SUBMITTED,
                'partnership_scope' => 'Local',
                'document_type' => 'MOU',
            ]);
            Document::query()->whereKey($matching->id)->update([
                'submitted_at' => now()->subDays(4),
            ]);

            $international = $this->document([
                'status' => Document::STATUS_SUBMITTED,
                'partnership_scope' => 'International',
            ]);
            Document::query()->whereKey($international->id)->update([
                'submitted_at' => now()->subDays(4),
            ]);

            $logged = $this->document([
                'status' => Document::STATUS_LOGGED,
                'partnership_scope' => 'Local',
            ]);
            Document::query()->whereKey($logged->id)->update([
                'submitted_at' => now()->subDays(2),
            ]);

            $boundary = $this->document([
                'status' => Document::STATUS_SUBMITTED,
                'partnership_scope' => 'Departmental',
            ]);
            Document::query()->whereKey($boundary->id)->update([
                'submitted_at' => now()->subDays(3),
            ]);

            $response = $this->getJson(
                '/api/iro/documents/incoming?'.http_build_query([
                    'search' => 'Engineering',
                    'partnership_scope' => 'Local',
                    'document_type' => 'MOU',
                    'department' => 'ENG',
                    'status' => Document::STATUS_SUBMITTED,
                    'date_from' => '2026-08-08',
                    'date_to' => '2026-08-12',
                ]),
                $this->authHeaders($iro)
            )->assertOk();

            $response->assertJsonCount(1, 'documents')
                ->assertJsonPath('documents.0.id', $matching->id)
                ->assertJsonPath('meta.total', 1)
                ->assertJsonPath('statistics.submitted', 1)
                ->assertJsonPath('statistics.pending', 1)
                ->assertJsonPath('statistics.older_than_three_days', 1);

            $this->getJson(
                '/api/iro/documents/incoming?partnership_scope=Departmental',
                $this->authHeaders($iro)
            )
                ->assertOk()
                ->assertJsonCount(1, 'documents')
                ->assertJsonPath('statistics.older_than_three_days', 0);
        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_status_tracker_filters_and_statistics_use_actual_matching_data(): void
    {
        Carbon::setTestNow('2026-08-13 12:00:00');

        try {
            $iro = $this->profile(Profile::ROLE_IRO_STAFF);
            $department = $this->department([
                'code' => 'SCS',
                'name' => 'School of Computer Studies',
            ]);
            $matching = $this->document([
                'department_id' => $department->id,
                'status' => Document::STATUS_LOGGED,
                'partnership_scope' => 'International',
            ]);
            Document::query()->whereKey($matching->id)->update([
                'submitted_at' => '2026-08-10 09:00:00',
                'updated_at' => '2026-08-09 09:00:00',
            ]);

            $this->document([
                'department_id' => $department->id,
                'status' => Document::STATUS_SUBMITTED,
                'partnership_scope' => 'Local',
            ]);
            $this->document([
                'status' => Document::STATUS_LOGGED,
                'partnership_scope' => 'International',
                'submitted_at' => '2026-08-01 09:00:00',
            ]);

            $response = $this->getJson(
                '/api/iro/documents/status?'.http_build_query([
                    'search' => 'Computer Studies',
                    'partnership_scope' => 'International',
                    'status' => Document::STATUS_LOGGED,
                    'date_from' => '2026-08-10',
                    'date_to' => '2026-08-10',
                ]),
                $this->authHeaders($iro)
            )->assertOk();

            $response->assertJsonCount(1, 'documents')
                ->assertJsonPath('documents.0.id', $matching->id)
                ->assertJsonPath('meta.total', 1)
                ->assertJsonPath('statistics.active', 1)
                ->assertJsonPath('statistics.pending', 1)
                ->assertJsonPath('statistics.status_older_than_three_days', 1)
                ->assertJsonMissingPath('documents.0.partnership_scope')
                ->assertJsonMissingPath('documents.0.title')
                ->assertJsonMissingPath('documents.0.partner_institution');
        } finally {
            Carbon::setTestNow();
        }
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

    public function test_iro_staff_can_forward_submitted_document_to_admin_once(): void
    {
        $iro = $this->profile(Profile::ROLE_IRO_STAFF);
        $document = $this->document([
            'status' => Document::STATUS_SUBMITTED,
        ]);

        $this->patchJson(
            "/api/iro/documents/{$document->id}/forward-to-admin",
            [
                'remarks' => 'Department details verified.',
            ],
            $this->authHeaders($iro)
        )
            ->assertOk()
            ->assertJsonPath('document.status', Document::STATUS_LOGGED);

        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => $iro->id,
            'document_id' => $document->id,
            'action' => 'iro_staff.document.forwarded_to_admin',
        ]);

        $audit = AuditLog::query()
            ->where('action', 'iro_staff.document.forwarded_to_admin')
            ->where('document_id', $document->id)
            ->firstOrFail();

        $this->assertSame(Document::STATUS_SUBMITTED, $audit->metadata['previous_status']);
        $this->assertSame(Document::STATUS_LOGGED, $audit->metadata['new_status']);
        $this->assertSame($iro->id, $audit->metadata['actor']['id']);
        $this->assertSame('iro_admin_validation_queue', $audit->metadata['destination']['type']);

        $this->patchJson(
            "/api/iro/documents/{$document->id}/forward-to-admin",
            [],
            $this->authHeaders($iro)
        )->assertUnprocessable();
    }

    public function test_iro_staff_can_return_submitted_document_to_existing_ownership(): void
    {
        $department = $this->department(['code' => 'OWN']);
        $submitter = $this->profile(Profile::ROLE_DEPARTMENT_STAFF, [
            'department_id' => $department->id,
        ]);
        $iro = $this->profile(Profile::ROLE_IRO_STAFF);
        $document = $this->document([
            'department_id' => $department->id,
            'submitted_by' => $submitter->id,
            'status' => Document::STATUS_SUBMITTED,
        ]);

        $this->patchJson(
            "/api/iro/documents/{$document->id}/return-for-correction",
            [
                'remarks' => 'Please include the missing authorization page.',
            ],
            $this->authHeaders($iro)
        )
            ->assertOk()
            ->assertJsonPath(
                'document.status',
                Document::STATUS_CORRECTIONS_NEEDED
            )
            ->assertJsonPath('document.department_id', $department->id)
            ->assertJsonPath('document.submitted_by', $submitter->id);

        $audit = AuditLog::query()
            ->where('action', 'iro_staff.document.returned_for_correction')
            ->where('document_id', $document->id)
            ->firstOrFail();

        $this->assertSame(Document::STATUS_SUBMITTED, $audit->metadata['previous_status']);
        $this->assertSame(Document::STATUS_CORRECTIONS_NEEDED, $audit->metadata['new_status']);
        $this->assertSame($iro->id, $audit->metadata['actor']['id']);
        $this->assertSame($submitter->id, $audit->metadata['destination']['submitted_by']);
        $this->assertSame($department->id, $audit->metadata['destination']['department_id']);
    }

    public function test_return_for_correction_requires_remarks_and_submitted_status(): void
    {
        $iro = $this->profile(Profile::ROLE_IRO_STAFF);
        $submitted = $this->document(['status' => Document::STATUS_SUBMITTED]);

        $this->patchJson(
            "/api/iro/documents/{$submitted->id}/return-for-correction",
            ['remarks' => ''],
            $this->authHeaders($iro)
        )->assertUnprocessable();

        $logged = $this->document(['status' => Document::STATUS_LOGGED]);
        $this->patchJson(
            "/api/iro/documents/{$logged->id}/return-for-correction",
            [
                'remarks' => 'A correction is required.',
            ],
            $this->authHeaders($iro)
        )->assertUnprocessable();
    }

    public function test_non_iro_staff_cannot_use_staff_forwarding_action(): void
    {
        $document = $this->document([
            'status' => Document::STATUS_SUBMITTED,
        ]);

        foreach ([Profile::ROLE_IRO_ADMIN, Profile::ROLE_DEPARTMENT_STAFF] as $role) {
            $actor = $this->profile($role);
            $this->patchJson(
                "/api/iro/documents/{$document->id}/forward-to-admin",
                [],
                $this->authHeaders($actor)
            )->assertForbidden();

            $this->patchJson(
                "/api/iro/documents/{$document->id}/return-for-correction",
                [
                    'remarks' => 'Not permitted.',
                ],
                $this->authHeaders($actor)
            )->assertForbidden();
        }
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
        $legal = $this->profile(Profile::ROLE_LEGAL_COUNSEL);
        $scs = $this->department([
            'code' => 'SCS',
            'name' => 'School of Computer Studies',
        ]);
        $document = $this->document([
            'department_id' => $scs->id,
            'partner_institution' => 'Ayala Mall Company',
            'partner_email' => 'contact@ayala.ph',
            'status' => Document::STATUS_LOGGED,
            'assigned_legal_counsel' => $legal->id,
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
        $this->assertDatabaseHas('documents', [
            'id' => $document->id,
            'assigned_legal_counsel' => null,
            'status' => Document::STATUS_CORRECTIONS_NEEDED,
        ]);
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

    public function test_iro_admin_can_return_logged_document_for_revision_with_audit_history(): void
    {
        $admin = $this->profile(Profile::ROLE_IRO_ADMIN);
        $document = $this->document(['status' => Document::STATUS_LOGGED]);
        $file = $this->documentFile([
            'document_id' => $document->id,
            'uploaded_by' => $admin->id,
            'version' => 2,
        ]);
        $annotation = AuditLog::query()->create([
            'actor_id' => $admin->id,
            'document_id' => $document->id,
            'document_file_id' => $file->id,
            'action' => 'document_file.annotated',
            'metadata' => [
                'highlight' => 'termination clause',
                'comment' => 'Confirm this language.',
                'version' => 2,
                'geometry' => ['page' => 1, 'rects' => [['x' => .1, 'y' => .1, 'width' => .2, 'height' => .03]]],
            ],
        ]);

        $this->patchJson(
            "/api/iro/documents/{$document->id}/admin-review/return",
            ['reason' => 'Please correct the termination clause.'],
            $this->authHeaders($admin)
        )->assertOk()->assertJsonPath('document.status', Document::STATUS_CORRECTIONS_NEEDED);

        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => $admin->id,
            'document_id' => $document->id,
            'action' => 'iro_admin.review.returned_for_revision',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'id' => $annotation->id,
            'action' => 'document_file.annotated',
        ]);

        $this->patchJson(
            "/api/iro/documents/{$document->id}/admin-review/return",
            ['reason' => 'A duplicate transition must fail.'],
            $this->authHeaders($admin)
        )->assertUnprocessable();
    }

    public function test_iro_admin_can_validate_logged_document_and_route_to_active_legal_counsel(): void
    {
        $admin = $this->profile(Profile::ROLE_IRO_ADMIN);
        $legal = $this->profile(Profile::ROLE_LEGAL_COUNSEL);
        $document = $this->document(['status' => Document::STATUS_LOGGED]);

        $this->patchJson(
            "/api/iro/documents/{$document->id}/admin-review/validate",
            ['legal_counsel_id' => $legal->id, 'comments' => 'Administrative review complete.'],
            $this->authHeaders($admin)
        )->assertOk()
            ->assertJsonPath('document.status', Document::STATUS_UNDER_LEGAL_REVIEW)
            ->assertJsonPath('document.assigned_legal_counsel', $legal->id);

        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => $admin->id,
            'document_id' => $document->id,
            'action' => 'iro_admin.review.validated_and_routed_to_legal',
        ]);
    }

    public function test_iro_staff_cannot_make_iro_admin_review_decisions(): void
    {
        $staff = $this->profile(Profile::ROLE_IRO_STAFF);
        $document = $this->document(['status' => Document::STATUS_LOGGED]);

        $this->patchJson(
            "/api/iro/documents/{$document->id}/admin-review/return",
            ['reason' => 'Unauthorized decision.'],
            $this->authHeaders($staff)
        )->assertForbidden();
    }
}
