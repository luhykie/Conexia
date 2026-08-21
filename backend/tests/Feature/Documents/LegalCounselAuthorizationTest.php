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

    public function test_legal_correction_returns_to_iro_admin_before_department(): void
    {
        $legal = $this->profile(Profile::ROLE_LEGAL_COUNSEL);
        $document = $this->document([
            'assigned_legal_counsel' => $legal->id,
            'status' => Document::STATUS_UNDER_LEGAL_REVIEW,
        ]);

        $this->patchJson(
            "/api/legal/documents/{$document->id}/decision",
            [
                'status' => Document::STATUS_CORRECTIONS_NEEDED,
                'legal_notes' => 'Revise the termination provision.',
            ],
            $this->authHeaders($legal)
        )->assertOk()
            ->assertJsonPath('document.status', Document::STATUS_CORRECTION_REQUIRED);

        $this->assertDatabaseHas('documents', [
            'id' => $document->id,
            'status' => Document::STATUS_CORRECTION_REQUIRED,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => $legal->id,
            'document_id' => $document->id,
            'action' => 'legal.review.correction_requested',
        ]);

        // The correction remains in Legal history after later workflow
        // transitions clear the document's current correction fields.
        $document->update([
            'status' => Document::STATUS_SUBMITTED,
            'legal_notes' => null,
        ]);

        $this->getJson('/api/legal/history', $this->authHeaders($legal))
            ->assertOk()
            ->assertJsonFragment([
                'document_id' => $document->id,
                'status' => 'Correction',
                'detail' => 'Revise the termination provision.',
            ]);
    }
}
