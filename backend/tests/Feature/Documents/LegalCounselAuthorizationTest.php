<?php

namespace Tests\Feature\Documents;

use App\Models\Document;
use App\Models\Profile;
use Tests\Feature\Support\SecurityTestCase;

class LegalCounselAuthorizationTest extends SecurityTestCase
{
    public function test_legal_counsel_sees_only_assigned_review_documents(): void
    {
        $legal = $this->profile(Profile::ROLE_LEGAL_COUNSEL);
        $otherLegal = $this->profile(Profile::ROLE_LEGAL_COUNSEL);

        $assigned = $this->document([
            'assigned_legal_counsel' => $legal->id,
            'status' => Document::STATUS_UNDER_LEGAL_REVIEW,
        ]);

        $notAssigned = $this->document([
            'assigned_legal_counsel' => $otherLegal->id,
            'status' => Document::STATUS_UNDER_LEGAL_REVIEW,
        ]);

        $response = $this->getJson(
            '/api/legal/documents/review',
            $this->authHeaders($legal)
        )->assertOk();

        $response->assertJsonFragment(['id' => $assigned->id]);
        $response->assertJsonMissing(['id' => $notAssigned->id]);
    }

    public function test_legal_counsel_cannot_decide_unassigned_document(): void
    {
        $legal = $this->profile(Profile::ROLE_LEGAL_COUNSEL);
        $otherLegal = $this->profile(Profile::ROLE_LEGAL_COUNSEL);

        $document = $this->document([
            'assigned_legal_counsel' => $otherLegal->id,
            'status' => Document::STATUS_UNDER_LEGAL_REVIEW,
        ]);

        $this->patchJson(
            "/api/legal/documents/{$document->id}/decision",
            ['status' => Document::STATUS_APPROVED],
            $this->authHeaders($legal)
        )->assertNotFound();
    }

    public function test_super_admin_cannot_access_legal_workflow(): void
    {
        $superAdmin = $this->profile(Profile::ROLE_SUPER_ADMIN);

        $this->getJson(
            '/api/legal/documents/review',
            $this->authHeaders($superAdmin)
        )->assertForbidden();
    }

    public function test_legal_decision_validation_returns_422(): void
    {
        $legal = $this->profile(Profile::ROLE_LEGAL_COUNSEL);

        $document = $this->document([
            'assigned_legal_counsel' => $legal->id,
            'status' => Document::STATUS_UNDER_LEGAL_REVIEW,
        ]);

        $this->patchJson(
            "/api/legal/documents/{$document->id}/decision",
            ['status' => Document::STATUS_CORRECTIONS_NEEDED],
            $this->authHeaders($legal)
        )->assertUnprocessable();
    }
}
