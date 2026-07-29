<?php

namespace Tests\Feature\Documents;

use App\Models\Document;
use App\Models\Profile;
use Tests\Feature\Support\SecurityTestCase;

class DepartmentDocumentAuthorizationTest extends SecurityTestCase
{
    public function test_department_staff_sees_only_own_department_documents(): void
    {
        $ownDepartment = $this->department(['code' => 'OWN']);
        $otherDepartment = $this->department(['code' => 'OTH']);

        $staff = $this->profile(
            Profile::ROLE_DEPARTMENT_STAFF,
            ['department_id' => $ownDepartment->id]
        );

        $ownDocument = $this->document([
            'department_id' => $ownDepartment->id,
            'submitted_by' => $staff->id,
        ]);

        $otherDocument = $this->document([
            'department_id' => $otherDepartment->id,
        ]);

        $response = $this->getJson(
            '/api/department/documents',
            $this->authHeaders($staff)
        )->assertOk();

        $response->assertJsonFragment([
            'id' => $ownDocument->id,
        ]);

        $response->assertJsonMissing([
            'id' => $otherDocument->id,
        ]);
    }

    public function test_department_staff_cannot_resubmit_another_departments_document(): void
    {
        $ownDepartment = $this->department(['code' => 'OWN']);
        $otherDepartment = $this->department(['code' => 'OTH']);

        $staff = $this->profile(
            Profile::ROLE_DEPARTMENT_STAFF,
            ['department_id' => $ownDepartment->id]
        );

        $otherDocument = $this->document([
            'department_id' => $otherDepartment->id,
            'status' => Document::STATUS_CORRECTIONS_NEEDED,
        ]);

        $this->patchJson(
            "/api/department/documents/{$otherDocument->id}/resubmit",
            [],
            $this->authHeaders($staff)
        )->assertNotFound();
    }

    public function test_department_staff_can_resubmit_own_corrected_document(): void
    {
        $department = $this->department();
        $staff = $this->profile(
            Profile::ROLE_DEPARTMENT_STAFF,
            ['department_id' => $department->id]
        );

        $document = $this->document([
            'department_id' => $department->id,
            'submitted_by' => $staff->id,
            'status' => Document::STATUS_CORRECTIONS_NEEDED,
            'legal_notes' => 'Fix this.',
        ]);

        $this->patchJson(
            "/api/department/documents/{$document->id}/resubmit",
            [],
            $this->authHeaders($staff)
        )
            ->assertOk()
            ->assertJsonPath('document.status', Document::STATUS_SUBMITTED)
            ->assertJsonPath('document.legal_notes', null);
    }

    public function test_department_document_store_requires_valid_payload(): void
    {
        $department = $this->department();
        $staff = $this->profile(
            Profile::ROLE_DEPARTMENT_STAFF,
            ['department_id' => $department->id]
        );

        $this->postJson(
            '/api/department/documents',
            [],
            $this->authHeaders($staff)
        )->assertUnprocessable();
    }
}
