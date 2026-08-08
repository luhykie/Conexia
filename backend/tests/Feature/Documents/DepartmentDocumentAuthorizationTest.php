<?php

namespace Tests\Feature\Documents;

use App\Models\Document;
use App\Models\Profile;
use Illuminate\Support\Carbon;
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

    public function test_department_document_store_generates_daily_tracking_numbers(): void
    {
        Carbon::setTestNow('2026-08-08 09:15:00');

        $department = $this->department();
        $staff = $this->profile(
            Profile::ROLE_DEPARTMENT_STAFF,
            ['department_id' => $department->id]
        );

        $first = $this->postJson(
            '/api/department/documents',
            $this->validPayload('First Partner'),
            $this->authHeaders($staff)
        )
            ->assertOk()
            ->assertJsonPath(
                'document.tracking_number',
                'CONEXIA-20260808-0001'
            )
            ->json('document');

        $second = $this->postJson(
            '/api/department/documents',
            $this->validPayload('Second Partner'),
            $this->authHeaders($staff)
        )
            ->assertOk()
            ->assertJsonPath(
                'document.tracking_number',
                'CONEXIA-20260808-0002'
            )
            ->json('document');

        Carbon::setTestNow('2026-08-09 08:00:00');

        $third = $this->postJson(
            '/api/department/documents',
            $this->validPayload('Third Partner'),
            $this->authHeaders($staff)
        )
            ->assertOk()
            ->assertJsonPath(
                'document.tracking_number',
                'CONEXIA-20260809-0001'
            )
            ->json('document');

        $this->assertNotSame(
            $first['tracking_number'],
            $second['tracking_number']
        );
        $this->assertNotSame(
            $second['tracking_number'],
            $third['tracking_number']
        );
    }

    public function test_client_supplied_tracking_number_is_ignored(): void
    {
        Carbon::setTestNow('2026-08-08 10:30:00');

        $department = $this->department();
        $staff = $this->profile(
            Profile::ROLE_DEPARTMENT_STAFF,
            ['department_id' => $department->id]
        );

        $payload = [
            ...$this->validPayload('Client Partner'),
            'tracking_number' => 'CLIENT-SHOULD-NOT-WIN',
        ];

        $this->postJson(
            '/api/department/documents',
            $payload,
            $this->authHeaders($staff)
        )
            ->assertOk()
            ->assertJsonPath(
                'document.tracking_number',
                'CONEXIA-20260808-0001'
            );
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    private function validPayload(string $partner): array
    {
        return [
            'title' => "{$partner} MOA",
            'document_type' => 'MOA',
            'partner_institution' => $partner,
            'partner_email' => 'partner@example.test',
            'description' => 'Generated tracking number test.',
        ];
    }
}
