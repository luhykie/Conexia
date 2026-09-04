<?php

namespace Tests\Feature\Documents;

use App\Models\AuditLog;
use App\Models\Document;
use App\Models\DocumentDepartmentReview;
use App\Models\Profile;
use Illuminate\Support\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Support\SecurityTestCase;

class IroDocumentAuthorizationTest extends SecurityTestCase
{
    public function test_iro_admin_history_resolves_version_one_and_the_exact_approved_version(): void
    {
        $admin = $this->profile(Profile::ROLE_IRO_ADMIN);
        $department = $this->department();
        $document = $this->document([
            'department_id' => $department->id,
            'partner_department_id' => $this->department()->id,
            'department_review_version' => 3,
            'status' => Document::STATUS_LOGGED,
        ]);
        $versionOne = $this->documentFile([
            'document_id' => $document->id,
            'uploaded_by' => $admin->id,
            'original_filename' => 'original-v1.pdf',
            'version' => 1,
        ]);
        $versionTwo = $this->documentFile([
            'document_id' => $document->id,
            'uploaded_by' => $admin->id,
            'original_filename' => 'approved-v2.pdf',
            'version' => 2,
        ]);
        $versionThree = $this->documentFile([
            'document_id' => $document->id,
            'uploaded_by' => $admin->id,
            'original_filename' => 'latest-v3.pdf',
            'version' => 3,
        ]);
        DocumentDepartmentReview::query()->create([
            'document_id' => $document->id,
            'department_id' => $department->id,
            'version' => 2,
            'approved_at' => now(),
            'approved_by' => $admin->id,
        ]);

        $this->getJson(
            "/api/iro/documents/{$document->id}/history",
            $this->authHeaders($admin)
        )->assertOk()
            ->assertJsonPath('original.file.id', $versionOne->id)
            ->assertJsonPath('original.file.version', 1)
            ->assertJsonPath('original.file.filename', 'original-v1.pdf')
            ->assertJsonPath('approved_document.file.id', $versionTwo->id)
            ->assertJsonPath('approved_document.file.version', 2)
            ->assertJsonPath('approved_document.file.filename', 'approved-v2.pdf')
            ->assertJsonPath('approved_document.approved_version', 2);

        $this->assertNotSame($versionThree->id, $versionTwo->id);
    }

    public function test_iro_admin_can_create_upload_view_and_route_an_office_owned_engagement(): void
    {
        Storage::fake('local');
        $admin = $this->profile(Profile::ROLE_IRO_ADMIN);
        $legal = $this->profile(Profile::ROLE_LEGAL_COUNSEL);
        $payload = [
            'title' => 'Office-owned agreement',
            'document_type' => 'MOA',
            'department_id' => null,
            'partner_institution' => 'Partner University',
            'partner_email' => 'partner@example.test',
            'description' => 'Agreement with a responsible office.',
            'partnership_type' => 'New Partnership',
            'partnership_scope' => 'International',
            'contact_person' => 'Alex Partner',
            'contact_email' => 'alex@example.test',
            'urgency' => 'Normal',
        ];

        $documentId = $this->postJson(
            '/api/iro/documents',
            $payload,
            $this->authHeaders($admin)
        )
            ->assertOk()
            ->assertJsonPath('document.department_id', null)
            ->assertJsonPath('document.department', null)
            ->assertJsonPath('document.submitted_by', $admin->id)
            ->assertJsonPath('document.partner_email', 'partner@example.test')
            ->json('document.id');

        $this->postJson(
            "/api/documents/{$documentId}/files",
            [
                'file' => UploadedFile::fake()
                    ->create('draft.pdf', 12, 'application/pdf'),
            ],
            $this->authHeaders($admin)
        )->assertCreated();

        $this->getJson(
            '/api/iro/documents/incoming',
            $this->authHeaders($admin)
        )
            ->assertOk()
            ->assertJsonPath('documents.0.id', $documentId)
            ->assertJsonPath('documents.0.department_id', null)
            ->assertJsonPath('documents.0.submitted_by', $admin->id)
            ->assertJsonPath('documents.0.created_by.role', Profile::ROLE_IRO_ADMIN);

        $this->patchJson(
            "/api/iro/documents/{$documentId}/admin-review/validate",
            [
                'legal_counsel_id' => $legal->id,
                'comments' => 'Administrative review complete.',
            ],
            $this->authHeaders($admin)
        )
            ->assertOk()
            ->assertJsonPath(
                'document.status',
                Document::STATUS_UNDER_LEGAL_REVIEW
            )
            ->assertJsonPath('document.assigned_legal_counsel', $legal->id);
    }

    public function test_iro_admin_edit_still_requires_a_department(): void
    {
        $admin = $this->profile(Profile::ROLE_IRO_ADMIN);
        $department = $this->department();

        $document = $this->document([
            'submitted_by' => $admin->id,
            'department_id' => $department->id,
            'status' => Document::STATUS_LOGGED,
        ]);

        $this->postJson(
            "/api/iro/documents/{$document->id}/engagement-edit",
            [
                ...$this->engagementEditPayload($department->id),
                'department_id' => null,
            ],
            $this->authHeaders($admin)
        )
            ->assertUnprocessable()
            ->assertJsonValidationErrors('department_id');

        $this->assertDatabaseHas('documents', [
            'id' => $document->id,
            'department_id' => $department->id,
        ]);
    }

    public function test_iro_admin_create_and_update_require_a_valid_partner_email(): void
    {
        $admin = $this->profile(Profile::ROLE_IRO_ADMIN);
        $department = $this->department();
        $payload = [
            'title' => 'Partner email validation',
            'document_type' => 'MOA',
            'department_id' => $department->id,
            'partner_institution' => 'Partner Organization',
            'partnership_type' => 'New Partnership',
            'partnership_scope' => 'Local',
            'contact_person' => 'Jamie Partner',
            'contact_email' => 'jamie@example.test',
            'urgency' => 'Normal',
        ];

        $this->postJson(
            '/api/iro/documents',
            $payload,
            $this->authHeaders($admin)
        )->assertUnprocessable()->assertJsonValidationErrors('partner_email');

        $this->postJson(
            '/api/iro/documents',
            [...$payload, 'partner_email' => 'invalid-email'],
            $this->authHeaders($admin)
        )->assertUnprocessable()->assertJsonValidationErrors('partner_email');

        $document = $this->document([
            'submitted_by' => $admin->id,
            'department_id' => $department->id,
            'partner_email' => 'original@example.test',
            'status' => Document::STATUS_LOGGED,
        ]);

        $this->postJson(
            "/api/iro/documents/{$document->id}/engagement-edit",
            [...$this->engagementEditPayload($department->id), 'partner_email' => 'invalid-email'],
            $this->authHeaders($admin)
        )->assertUnprocessable()->assertJsonValidationErrors('partner_email');

        $this->assertDatabaseHas('documents', [
            'id' => $document->id,
            'partner_email' => 'original@example.test',
        ]);
    }

    public function test_iro_incoming_route_excludes_archived_records(): void
    {
        $iro = $this->profile(Profile::ROLE_IRO_ADMIN);

        $submitted = $this->document([
            'status' => Document::STATUS_LOGGED,
            'title' => 'Visible Incoming Agreement',
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
        $response->assertJsonPath(
            'data.0.title',
            'Visible Incoming Agreement'
        );
        $response->assertJsonPath('data.0.document_type', 'MOA');
    }

    public function test_iro_admin_incoming_queue_contains_only_logged_documents(): void
    {
        $iroAdmin = $this->profile(Profile::ROLE_IRO_ADMIN);
        $submitted = $this->document([
            'status' => Document::STATUS_SUBMITTED,
        ]);
        $logged = $this->document([
            'status' => Document::STATUS_LOGGED,
            'title' => 'Logged Research Agreement',
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
            ->assertJsonPath('documents.0.title', 'Logged Research Agreement')
            ->assertJsonPath('documents.0.status', Document::STATUS_LOGGED)
            ->assertJsonPath('meta.total', 1);

        $response->assertJsonMissing(['id' => $submitted->id]);
        $response->assertJsonMissing(['id' => $underReview->id]);

        $this->getJson(
            '/api/iro/documents/incoming?search=Research%20Agreement',
            $this->authHeaders($iroAdmin)
        )
            ->assertOk()
            ->assertJsonCount(1, 'documents')
            ->assertJsonPath('documents.0.id', $logged->id);

        $this->getJson(
            '/api/iro/documents/incoming?title=research%20AGREE',
            $this->authHeaders($iroAdmin)
        )
            ->assertOk()
            ->assertJsonCount(1, 'documents')
            ->assertJsonPath('documents.0.id', $logged->id)
            ->assertJsonPath('meta.total', 1);

        $this->getJson(
            '/api/iro/documents/incoming?title[]=invalid',
            $this->authHeaders($iroAdmin)
        )
            ->assertUnprocessable()
            ->assertJsonValidationErrors('title');

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

    public function test_iro_admin_document_view_status_is_per_viewer_and_recorded_after_open(): void
    {
        $viewer = $this->profile(Profile::ROLE_IRO_ADMIN, [
            'full_name' => 'Ada Admin',
        ]);
        $otherAdmin = $this->profile(Profile::ROLE_IRO_ADMIN);
        $unauthorized = $this->profile(Profile::ROLE_LEGAL_COUNSEL);
        $document = $this->document([
            'status' => Document::STATUS_LOGGED,
        ]);

        $this->getJson(
            '/api/iro/documents/incoming',
            $this->authHeaders($viewer)
        )
            ->assertOk()
            ->assertJsonPath('documents.0.viewed', false);

        $this->getJson(
            "/api/iro/documents/{$document->id}",
            $this->authHeaders($viewer)
        )->assertOk();

        $this->assertDatabaseMissing('audit_logs', [
            'actor_id' => $viewer->id,
            'document_id' => $document->id,
            'action' => 'document.viewed',
        ]);

        $this->postJson(
            "/api/iro/documents/{$document->id}/view",
            [],
            $this->authHeaders($unauthorized)
        )->assertForbidden();

        $this->postJson(
            "/api/iro/documents/{$document->id}/view",
            [],
            $this->authHeaders($viewer)
        )
            ->assertOk()
            ->assertJsonPath('data.viewed', true);

        $this->postJson(
            "/api/iro/documents/{$document->id}/view",
            [],
            $this->authHeaders($viewer)
        )->assertOk();

        $this->assertSame(
            1,
            AuditLog::query()
                ->where('actor_id', $viewer->id)
                ->where('document_id', $document->id)
                ->where('action', 'document.viewed')
                ->count()
        );

        $this->getJson(
            '/api/iro/documents/incoming',
            $this->authHeaders($viewer)
        )
            ->assertOk()
            ->assertJsonPath('documents.0.viewed', true);

        $this->getJson(
            '/api/iro/documents/incoming',
            $this->authHeaders($otherAdmin)
        )
            ->assertOk()
            ->assertJsonPath('documents.0.viewed', false);

        $this->getJson(
            "/api/iro/documents/{$document->id}/history",
            $this->authHeaders($viewer)
        )
            ->assertOk()
            ->assertJsonPath('events.0.action', 'document.viewed')
            ->assertJsonPath('events.0.label', 'Document viewed')
            ->assertJsonPath('events.0.actor', 'Ada Admin')
            ->assertJsonPath('events.0.created_at', fn ($value) =>
                is_string($value) && $value !== ''
            );
    }

    public function test_iro_admin_document_view_status_is_per_viewer_and_idempotent(): void
    {
        $viewer = $this->profile(Profile::ROLE_IRO_ADMIN, [
            'full_name' => 'PAIR IRO Administrator',
        ]);
        $otherAdmin = $this->profile(Profile::ROLE_IRO_ADMIN);
        $document = $this->document([
            'status' => Document::STATUS_LOGGED,
        ]);

        $this->getJson(
            '/api/iro/documents/incoming',
            $this->authHeaders($viewer)
        )
            ->assertOk()
            ->assertJsonPath('documents.0.viewed', false);

        $this->getJson(
            "/api/iro/documents/{$document->id}",
            $this->authHeaders($viewer)
        )->assertOk();

        $this->assertDatabaseMissing('audit_logs', [
            'actor_id' => $viewer->id,
            'document_id' => $document->id,
            'action' => 'document.viewed',
        ]);

        $this->postJson(
            "/api/iro/documents/{$document->id}/view",
            [],
            $this->authHeaders($viewer)
        )->assertOk();

        $this->postJson(
            "/api/iro/documents/{$document->id}/view",
            [],
            $this->authHeaders($viewer)
        )->assertOk();

        $this->assertSame(
            1,
            AuditLog::query()
                ->where('actor_id', $viewer->id)
                ->where('document_id', $document->id)
                ->where('action', 'document.viewed')
                ->count()
        );

        $this->getJson(
            '/api/iro/documents/incoming',
            $this->authHeaders($viewer)
        )
            ->assertOk()
            ->assertJsonPath('documents.0.viewed', true);

        $this->getJson(
            '/api/iro/documents/incoming',
            $this->authHeaders($otherAdmin)
        )
            ->assertOk()
            ->assertJsonPath('documents.0.viewed', false);

        $this->getJson(
            "/api/iro/documents/{$document->id}/history",
            $this->authHeaders($viewer)
        )
            ->assertOk()
            ->assertJsonPath('events.0.action', 'document.viewed')
            ->assertJsonPath('events.0.label', 'Document viewed')
            ->assertJsonPath('events.0.actor', 'PAIR IRO Administrator')
            ->assertJsonPath('events.0.created_at', fn ($value) =>
                is_string($value) && $value !== ''
            );

    }

    public function test_iro_admin_can_view_submission_details(): void
    {
        $iro = $this->profile(Profile::ROLE_IRO_ADMIN);
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
            $iro = $this->profile(Profile::ROLE_IRO_ADMIN);
            $department = $this->department([
                'code' => 'ENG',
                'name' => 'Engineering',
            ]);
            $matching = $this->document([
                'department_id' => $department->id,
                'status' => Document::STATUS_LOGGED,
                'title' => 'Cross-Border Exchange Agreement',
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

            $response = $this->getJson(
                '/api/iro/documents/incoming?'.http_build_query([
                    'search' => 'Engineering',
                    'title' => 'exchange AGREEMENT',
                    'partnership_scope' => 'Local',
                    'document_type' => 'MOU',
                    'department' => 'ENG',
                    'status' => Document::STATUS_LOGGED,
                    'date_from' => '2026-08-08',
                    'date_to' => '2026-08-12',
                ]),
                $this->authHeaders($iro)
            )->assertOk();

            $response->assertJsonCount(1, 'documents')
                ->assertJsonPath('documents.0.id', $matching->id)
                ->assertJsonPath('meta.total', 1)
                ->assertJsonPath('statistics.submitted', 0)
                ->assertJsonPath('statistics.pending', 1)
                ->assertJsonPath('statistics.older_than_three_days', 1);

        } finally {
            Carbon::setTestNow();
        }
    }

    public function test_status_tracker_filters_and_statistics_use_actual_matching_data(): void
    {
        Carbon::setTestNow('2026-08-13 12:00:00');

        try {
            $iro = $this->profile(Profile::ROLE_IRO_ADMIN);
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
            $pendingNotarization = $this->document([
                'status' => Document::STATUS_PENDING_NOTARIZATION,
            ]);
            $notarized = $this->document([
                'status' => Document::STATUS_NOTARIZED,
                'notarial_reference_number' => 'NOTARY-001',
                'notarization_date' => '2026-08-12',
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
                ->assertJsonPath('documents.0.partnership_scope', 'International')
                ->assertJsonMissingPath('documents.0.notarial_reference_number')
                ->assertJsonMissingPath('documents.0.notarization_date');

            $allStatuses = $this->getJson(
                '/api/iro/documents/status?per_page=100',
                $this->authHeaders($iro)
            )->assertOk();

            $allStatuses
                ->assertJsonMissing(['id' => $pendingNotarization->id])
                ->assertJsonMissing(['id' => $notarized->id]);
        } finally {
            Carbon::setTestNow();
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

        $document = $this->document([
            'status' => Document::STATUS_ARCHIVED,
            'archived_at' => now(),
        ]);

        $this->patchJson(
            "/api/iro/documents/{$document->id}/reassign-legal",
            [
                'destination_type' => 'legal_counsel',
                'destination_id' => $legal->id,
                'reason' => 'Archived records should be rejected.',
            ],
            $this->authHeaders($iro)
        )->assertUnprocessable();

        $notarized = $this->document([
            'status' => Document::STATUS_NOTARIZED,
        ]);

        $this->patchJson(
            "/api/iro/documents/{$notarized->id}/reassign-legal",
            [
                'destination_type' => 'legal_counsel',
                'destination_id' => $legal->id,
                'reason' => 'Hidden stages cannot be reassigned.',
            ],
            $this->authHeaders($iro)
        )->assertNotFound();
    }

    public function test_reassignable_documents_exclude_archived_and_actionless_records(): void
    {
        $iro = $this->profile(Profile::ROLE_IRO_ADMIN);
        $department = $this->department();
        $archived = $this->document([
            'department_id' => $department->id,
            'status' => Document::STATUS_ARCHIVED,
            'archived_at' => now(),
        ]);
        $actionless = $this->document([
            'department_id' => null,
            'status' => Document::STATUS_LOGGED,
        ]);
        $actionless->update(['partner_institution' => null]);
        $reassignable = $this->document([
            'department_id' => $department->id,
            'status' => Document::STATUS_LOGGED,
        ]);

        $response = $this->getJson(
            '/api/iro/documents/reassignable?per_page=100',
            $this->authHeaders($iro)
        )->assertOk();

        $response
            ->assertJsonMissing(['id' => $archived->id])
            ->assertJsonMissing(['id' => $actionless->id])
            ->assertJsonFragment(['id' => $reassignable->id]);

        foreach ($response->json('documents') as $document) {
            $this->assertNotSame(Document::STATUS_ARCHIVED, $document['status']);
            $this->assertNotEmpty($document['reassignment_destinations']);
        }
    }

    public function test_every_status_in_reassignable_documents_has_an_action(): void
    {
        $iro = $this->profile(Profile::ROLE_IRO_ADMIN);
        $department = $this->department();
        $this->profile(Profile::ROLE_LEGAL_COUNSEL);
        $statuses = [
            Document::STATUS_SUBMITTED,
            Document::STATUS_DEPARTMENT_REVIEW,
            Document::STATUS_PARTNER_REVIEW_COMPLETE,
            Document::STATUS_LOGGED,
            Document::STATUS_UNDER_LEGAL_REVIEW,
            Document::STATUS_CORRECTION_REQUIRED,
            Document::STATUS_CORRECTIONS_NEEDED,
            Document::STATUS_APPROVED,
        ];

        foreach ($statuses as $status) {
            $this->document([
                'department_id' => $department->id,
                'status' => $status,
            ]);
        }

        $response = $this->getJson(
            '/api/iro/documents/reassignable?per_page=100',
            $this->authHeaders($iro)
        )->assertOk();

        $returned = collect($response->json('documents'));
        $this->assertEqualsCanonicalizing(
            $statuses,
            $returned->pluck('status')->unique()->all()
        );
        $returned->each(fn (array $document) =>
            $this->assertNotEmpty($document['reassignment_destinations'])
        );
    }

    public function test_iro_admin_can_archive_approved_document_without_losing_related_data(): void
    {
        $admin = $this->profile(Profile::ROLE_IRO_ADMIN);
        $department = $this->department();
        $document = $this->document([
            'department_id' => $department->id,
            'document_type' => 'MOA',
            'status' => Document::STATUS_APPROVED,
        ]);
        $file = $this->documentFile([
            'document_id' => $document->id,
            'uploaded_by' => $admin->id,
            'version' => 1,
        ]);
        $approvedAt = now()->subHour();
        DocumentDepartmentReview::query()->create([
            'document_id' => $document->id,
            'department_id' => $department->id,
            'version' => 1,
            'approved_at' => $approvedAt,
        ]);
        $history = AuditLog::query()->create([
            'actor_id' => $admin->id,
            'document_id' => $document->id,
            'document_file_id' => $file->id,
            'action' => 'legal.review.approved',
            'metadata' => ['document_version' => 1],
        ]);

        $this->patchJson(
            "/api/iro/documents/{$document->id}/archive",
            [],
            $this->authHeaders($admin)
        )
            ->assertOk()
            ->assertJsonPath('document.status', Document::STATUS_ARCHIVED)
            ->assertJsonPath('document.archived_by', $admin->id)
            ->assertJsonPath('document.archived_at', fn ($value) => is_string($value));

        $this->assertDatabaseHas('document_files', [
            'id' => $file->id,
            'document_id' => $document->id,
            'version' => 1,
        ]);
        $this->assertDatabaseHas('document_department_reviews', [
            'document_id' => $document->id,
            'version' => 1,
            'approved_at' => $approvedAt,
        ]);
        $this->assertDatabaseHas('audit_logs', ['id' => $history->id]);

        $archiveAudit = AuditLog::query()
            ->where('document_id', $document->id)
            ->where('action', 'iro_admin.document.archived')
            ->firstOrFail();
        $this->assertSame($admin->id, $archiveAudit->actor_id);
        $this->assertNotEmpty($archiveAudit->metadata['acted_at']);
    }

    public function test_only_iro_admin_can_archive_or_unarchive_documents(): void
    {
        $legal = $this->profile(Profile::ROLE_LEGAL_COUNSEL);
        $approved = $this->document(['status' => Document::STATUS_APPROVED]);
        $archived = $this->document([
            'status' => Document::STATUS_ARCHIVED,
            'archived_at' => now(),
        ]);

        $this->patchJson(
            "/api/iro/documents/{$approved->id}/archive",
            [],
            $this->authHeaders($legal)
        )->assertForbidden();
        $this->patchJson(
            "/api/iro/documents/{$archived->id}/unarchive",
            [],
            $this->authHeaders($legal)
        )->assertForbidden();
    }

    public function test_iro_admin_can_unarchive_document_to_pending_archival(): void
    {
        $iro = $this->profile(Profile::ROLE_IRO_ADMIN);
        $this->profile(Profile::ROLE_LEGAL_COUNSEL);
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
            ->assertJsonPath('document.status', Document::STATUS_APPROVED)
            ->assertJsonPath('document.tracking_number', $trackingNumber);

        $this->assertDatabaseHas('documents', [
            'id' => $document->id,
            'tracking_number' => $trackingNumber,
            'status' => Document::STATUS_APPROVED,
            'archived_at' => null,
            'archived_by' => null,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => $iro->id,
            'document_id' => $document->id,
            'action' => 'iro_admin.document.unarchived',
        ]);

        $this->getJson(
            '/api/iro/documents/reassignable?per_page=100',
            $this->authHeaders($iro)
        )
            ->assertOk()
            ->assertJsonFragment([
                'id' => $document->id,
                'status' => Document::STATUS_APPROVED,
            ]);

        $audit = AuditLog::query()
            ->where('document_id', $document->id)
            ->where('action', 'iro_admin.document.unarchived')
            ->firstOrFail();
        $this->assertSame(Document::STATUS_APPROVED, $audit->metadata['new_status']);
        $this->assertNotEmpty($audit->metadata['acted_at']);

        $this->getJson('/api/iro/archive?status=Pending%20Archival', $this->authHeaders($iro))
            ->assertOk()
            ->assertJsonFragment([
                'id' => $document->id,
                'completion' => 'Pending Archival',
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
        $this->assertSame(
            'Please correct the termination clause.',
            AuditLog::query()
                ->where('document_id', $document->id)
                ->where('action', 'iro_admin.review.returned_for_revision')
                ->firstOrFail()
                ->metadata['reason']
        );
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

    public function test_iro_admin_can_return_logged_document_without_remarks(): void
    {
        $admin = $this->profile(Profile::ROLE_IRO_ADMIN);
        $document = $this->document(['status' => Document::STATUS_LOGGED]);

        $this->patchJson(
            "/api/iro/documents/{$document->id}/admin-review/return",
            [],
            $this->authHeaders($admin)
        )
            ->assertOk()
            ->assertJsonPath(
                'document.status',
                Document::STATUS_CORRECTIONS_NEEDED
            );

        $this->assertNull(
            AuditLog::query()
                ->where('document_id', $document->id)
                ->where('action', 'iro_admin.review.returned_for_revision')
                ->firstOrFail()
                ->metadata['reason']
        );
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

        $withoutRemarks = $this->document([
            'status' => Document::STATUS_LOGGED,
        ]);
        $this->patchJson(
            "/api/iro/documents/{$withoutRemarks->id}/admin-review/validate",
            ['legal_counsel_id' => $legal->id, 'comments' => ''],
            $this->authHeaders($admin)
        )
            ->assertOk()
            ->assertJsonPath(
                'document.status',
                Document::STATUS_UNDER_LEGAL_REVIEW
            );
    }

    public function test_iro_admin_routes_legal_correction_to_originating_department(): void
    {
        $admin = $this->profile(Profile::ROLE_IRO_ADMIN);
        $legal = $this->profile(Profile::ROLE_LEGAL_COUNSEL);
        $departmentStaff = $this->profile(Profile::ROLE_DEPARTMENT_STAFF);
        $document = $this->document([
            'submitted_by' => $departmentStaff->id,
            'status' => Document::STATUS_CORRECTION_REQUIRED,
            'assigned_legal_counsel' => $legal->id,
            'legal_notes' => 'Revise the termination provision.',
        ]);

        $this->patchJson(
            "/api/iro/documents/{$document->id}/legal-correction/route-to-department",
            [],
            $this->authHeaders($admin)
        )->assertOk()
            ->assertJsonPath('document.status', Document::STATUS_CORRECTIONS_NEEDED)
            ->assertJsonPath('document.assigned_legal_counsel', $legal->id);

        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => $admin->id,
            'document_id' => $document->id,
            'action' => 'iro_admin.legal_correction.routed_to_department',
        ]);
    }

    public function test_iro_admin_created_legal_correction_stays_in_direct_review_and_can_return_to_legal(): void
    {
        $admin = $this->profile(Profile::ROLE_IRO_ADMIN);
        $legal = $this->profile(Profile::ROLE_LEGAL_COUNSEL);
        $document = $this->document([
            'submitted_by' => $admin->id,
            'department_id' => null,
            'status' => Document::STATUS_CORRECTION_REQUIRED,
            'assigned_legal_counsel' => $legal->id,
            'legal_notes' => 'Clarify the termination provision.',
        ]);

        $this->getJson(
            '/api/iro/documents/incoming',
            $this->authHeaders($admin)
        )
            ->assertOk()
            ->assertJsonPath('documents.0.id', $document->id)
            ->assertJsonPath('documents.0.department_id', null)
            ->assertJsonPath('documents.0.created_by.role', Profile::ROLE_IRO_ADMIN);

        $this->patchJson(
            "/api/iro/documents/{$document->id}/legal-correction/route-to-department",
            [],
            $this->authHeaders($admin)
        )
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');

        $this->patchJson(
            "/api/iro/documents/{$document->id}/admin-review/validate",
            [
                'legal_counsel_id' => $legal->id,
                'comments' => 'IRO Admin review complete.',
            ],
            $this->authHeaders($admin)
        )
            ->assertOk()
            ->assertJsonPath('document.status', Document::STATUS_UNDER_LEGAL_REVIEW)
            ->assertJsonPath('document.assigned_legal_counsel', $legal->id);

        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => $admin->id,
            'document_id' => $document->id,
            'action' => 'iro_admin.review.validated_and_routed_to_legal',
        ]);
    }

    public function test_iro_admin_can_edit_own_engagement_metadata_with_audit_history(): void
    {
        $admin = $this->profile(Profile::ROLE_IRO_ADMIN);
        $department = $this->department(['code' => 'IRO']);
        $document = $this->document([
            'submitted_by' => $admin->id,
            'department_id' => $department->id,
            'status' => Document::STATUS_LOGGED,
        ]);

        $this->postJson(
            "/api/iro/documents/{$document->id}/engagement-edit",
            $this->engagementEditPayload($department->id),
            $this->authHeaders($admin)
        )
            ->assertOk()
            ->assertJsonPath('document.title', 'Updated Partnership Agreement')
            ->assertJsonPath('document.partner_email', 'updated.partner@example.test')
            ->assertJsonPath('document.partnership_scope', 'International')
            ->assertJsonPath('document.can_edit_engagement', true);

        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => $admin->id,
            'document_id' => $document->id,
            'action' => 'iro_admin.engagement.updated',
        ]);
        $log = AuditLog::query()
            ->where('document_id', $document->id)
            ->where('action', 'iro_admin.engagement.updated')
            ->firstOrFail();
        $this->assertSame(
            'Updated Partnership Agreement',
            $log->metadata['changes']['title']['to']
        );
    }

    public function test_iro_admin_agreement_revision_creates_a_new_file_version(): void
    {
        Storage::fake('local');
        $admin = $this->profile(Profile::ROLE_IRO_ADMIN);
        $department = $this->department();
        $document = $this->document([
            'submitted_by' => $admin->id,
            'department_id' => $department->id,
            'status' => Document::STATUS_CORRECTIONS_NEEDED,
        ]);
        $original = $this->documentFile([
            'document_id' => $document->id,
            'uploaded_by' => $admin->id,
            'version' => 1,
            'original_filename' => 'original.pdf',
        ]);

        $response = $this->post(
            "/api/iro/documents/{$document->id}/engagement-edit",
            [
                ...$this->engagementEditPayload($department->id),
                'agreement_file' => UploadedFile::fake()->create(
                    'revised.pdf',
                    100,
                    'application/pdf'
                ),
            ],
            $this->authHeaders($admin)
        );

        $response->assertOk()->assertJsonPath('file.version', 2);
        $this->assertDatabaseHas('document_files', [
            'id' => $original->id,
            'version' => 1,
            'deleted_at' => null,
        ]);
        $this->assertDatabaseHas('document_files', [
            'document_id' => $document->id,
            'original_filename' => 'revised.pdf',
            'version' => 2,
            'deleted_at' => null,
        ]);
    }

    public function test_engagement_edit_rejects_locked_stages_and_non_iro_origin(): void
    {
        $admin = $this->profile(Profile::ROLE_IRO_ADMIN);
        $legalCounsel = $this->profile(Profile::ROLE_LEGAL_COUNSEL);
        $departmentStaff = $this->profile(Profile::ROLE_DEPARTMENT_STAFF);
        $department = $this->department();

        foreach ([
            Document::STATUS_UNDER_LEGAL_REVIEW,
            Document::STATUS_APPROVED,
            Document::STATUS_ARCHIVED,
        ] as $status) {
            $document = $this->document([
                'submitted_by' => $admin->id,
                'department_id' => $department->id,
                'status' => $status,
            ]);
            $this->postJson(
                "/api/iro/documents/{$document->id}/engagement-edit",
                $this->engagementEditPayload($department->id),
                $this->authHeaders($admin)
            )->assertUnprocessable();
        }

        foreach ([
            Document::STATUS_PENDING_NOTARIZATION,
            Document::STATUS_NOTARIZED,
        ] as $status) {
            $document = $this->document([
                'submitted_by' => $admin->id,
                'department_id' => $department->id,
                'status' => $status,
            ]);
            $this->postJson(
                "/api/iro/documents/{$document->id}/engagement-edit",
                $this->engagementEditPayload($department->id),
                $this->authHeaders($admin)
            )->assertNotFound();
        }

        $departmentDocument = $this->document([
            'submitted_by' => $departmentStaff->id,
            'department_id' => $department->id,
            'status' => Document::STATUS_SUBMITTED,
        ]);
        $this->postJson(
            "/api/iro/documents/{$departmentDocument->id}/engagement-edit",
            $this->engagementEditPayload($department->id),
            $this->authHeaders($admin)
        )->assertUnprocessable();

        $editableDocument = $this->document([
            'submitted_by' => $admin->id,
            'department_id' => $department->id,
            'status' => Document::STATUS_SUBMITTED,
        ]);
        $this->postJson(
            "/api/iro/documents/{$editableDocument->id}/engagement-edit",
            $this->engagementEditPayload($department->id),
            $this->authHeaders($legalCounsel)
        )->assertForbidden();
    }

    private function engagementEditPayload(string $departmentId): array
    {
        return [
            'title' => 'Updated Partnership Agreement',
            'document_type' => 'MOU',
            'partnership_type' => 'Renewal',
            'partnership_scope' => 'International',
            'department_id' => $departmentId,
            'partner_institution' => 'Updated Partner University',
            'partner_email' => 'updated.partner@example.test',
            'description' => 'Updated engagement purpose.',
            'contact_person' => 'Jordan Partner',
            'contact_position' => 'Director',
            'contact_email' => 'jordan@example.test',
            'contact_number' => '+639171234567',
        ];
    }
}
