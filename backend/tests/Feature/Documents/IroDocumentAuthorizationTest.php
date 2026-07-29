<?php

namespace Tests\Feature\Documents;

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
    }

    public function test_iro_staff_can_log_submitted_document(): void
    {
        $iro = $this->profile(Profile::ROLE_IRO_STAFF);
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
}
