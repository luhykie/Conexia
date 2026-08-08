<?php

namespace Tests\Feature\Workflow;

use App\Models\Document;
use App\Models\Profile;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Support\SecurityTestCase;

class DocumentLifecycleTest extends SecurityTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
    }

    public function test_document_can_move_through_complete_workflow(): void
    {
        $department = $this->department(['code' => 'SCS']);
        $staff = $this->profile(Profile::ROLE_DEPARTMENT_STAFF, [
            'department_id' => $department->id,
        ]);
        $iro = $this->profile(Profile::ROLE_IRO_ADMIN);
        $legal = $this->profile(Profile::ROLE_LEGAL_COUNSEL);

        $document = $this->postJson(
            '/api/department/documents',
            [
                'title' => 'E2E Partnership MOA',
                'document_type' => 'MOA',
                'partner_institution' => 'E2E Partner',
                'partner_email' => 'partner@example.test',
                'description' => 'Lifecycle validation.',
            ],
            $this->authHeaders($staff)
        )
            ->assertOk()
            ->assertJsonPath('document.status', Document::STATUS_SUBMITTED)
            ->json('document');

        $documentId = $document['id'];

        $this->postJson(
            "/api/documents/{$documentId}/files",
            [
                'file' => UploadedFile::fake()
                    ->create('draft.pdf', 12, 'application/pdf'),
            ],
            $this->authHeaders($staff)
        )->assertCreated();

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'document_file.uploaded',
            'document_id' => $documentId,
            'actor_id' => $staff->id,
        ]);

        $this->patchJson(
            "/api/iro/documents/{$documentId}/log",
            [],
            $this->authHeaders($iro)
        )
            ->assertOk()
            ->assertJsonPath('document.status', Document::STATUS_LOGGED);

        $this->patchJson(
            "/api/iro/documents/{$documentId}/assign-legal",
            ['legal_counsel_id' => $legal->id],
            $this->authHeaders($iro)
        )
            ->assertOk()
            ->assertJsonPath(
                'document.status',
                Document::STATUS_UNDER_LEGAL_REVIEW
            );

        $this->patchJson(
            "/api/legal/documents/{$documentId}/decision",
            [
                'status' => Document::STATUS_CORRECTIONS_NEEDED,
                'legal_notes' => 'Please revise clause 3.',
            ],
            $this->authHeaders($legal)
        )
            ->assertOk()
            ->assertJsonPath(
                'document.status',
                Document::STATUS_CORRECTIONS_NEEDED
            );

        $this->patchJson(
            "/api/department/documents/{$documentId}/resubmit",
            [],
            $this->authHeaders($staff)
        )
            ->assertOk()
            ->assertJsonPath('document.status', Document::STATUS_SUBMITTED)
            ->assertJsonPath('document.legal_notes', null);

        $this->patchJson(
            "/api/iro/documents/{$documentId}/log",
            [],
            $this->authHeaders($iro)
        )->assertOk();

        $this->patchJson(
            "/api/iro/documents/{$documentId}/assign-legal",
            ['legal_counsel_id' => $legal->id],
            $this->authHeaders($iro)
        )->assertOk();

        $this->patchJson(
            "/api/legal/documents/{$documentId}/decision",
            [
                'status' => Document::STATUS_APPROVED,
                'legal_notes' => null,
            ],
            $this->authHeaders($legal)
        )
            ->assertOk()
            ->assertJsonPath('document.status', Document::STATUS_APPROVED);

        $notarizationData = [
            'notarial_reference_number' => 'NOTARY-E2E-001',
            'notarization_date' => now()->toDateString(),
            'notary_signature_code' => 'SIG-E2E-001',
        ];

        $this->patchJson(
            "/api/legal/documents/{$documentId}/notarization/submit",
            $notarizationData,
            $this->authHeaders($legal)
        )
            ->assertOk()
            ->assertJsonPath(
                'document.status',
                Document::STATUS_PENDING_NOTARIZATION
            );

        $this->patchJson(
            "/api/legal/documents/{$documentId}/notarization/complete",
            $notarizationData,
            $this->authHeaders($legal)
        )
            ->assertOk()
            ->assertJsonPath('document.status', Document::STATUS_NOTARIZED);

        $this->patchJson(
            "/api/iro/documents/{$documentId}/archive",
            [],
            $this->authHeaders($iro)
        )
            ->assertOk()
            ->assertJsonPath('document.status', Document::STATUS_ARCHIVED);

        $this->getJson(
            '/api/iro/documents/incoming',
            $this->authHeaders($iro)
        )->assertJsonMissing(['id' => $documentId]);

        $this->getJson(
            '/api/iro/archive',
            $this->authHeaders(
                $this->profile(Profile::ROLE_IRO_ADMIN)
            )
        )->assertJsonFragment(['id' => $documentId]);
    }
}
