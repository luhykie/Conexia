<?php

namespace Tests\Feature\Pagination;

use App\Models\Document;
use App\Models\Profile;
use Tests\Feature\Support\SecurityTestCase;

class ListEndpointPaginationTest extends SecurityTestCase
{
    public function test_department_documents_use_default_pagination(): void
    {
        [$staff, $department] = $this->departmentStaff();

        $this->createDepartmentDocuments($department->id, 16);

        $response = $this->getJson(
            '/api/department/documents',
            $this->authHeaders($staff)
        )->assertOk();

        $response
            ->assertJsonPath('meta.current_page', 1)
            ->assertJsonPath('meta.per_page', 15)
            ->assertJsonPath('meta.total', 16)
            ->assertJsonPath('meta.last_page', 2);

        $this->assertCount(15, $response->json('data'));
    }

    public function test_department_documents_accept_custom_per_page(): void
    {
        [$staff, $department] = $this->departmentStaff();

        $this->createDepartmentDocuments($department->id, 8);

        $response = $this->getJson(
            '/api/department/documents?per_page=5',
            $this->authHeaders($staff)
        )->assertOk();

        $response
            ->assertJsonPath('meta.per_page', 5)
            ->assertJsonPath('meta.total', 8);

        $this->assertCount(5, $response->json('data'));
    }

    public function test_per_page_is_clamped_to_safe_maximum(): void
    {
        [$staff, $department] = $this->departmentStaff();

        $this->createDepartmentDocuments($department->id, 3);

        $this->getJson(
            '/api/department/documents?per_page=500',
            $this->authHeaders($staff)
        )
            ->assertOk()
            ->assertJsonPath('meta.per_page', 100);
    }

    public function test_invalid_page_values_are_rejected(): void
    {
        [$staff] = $this->departmentStaff();

        $this->getJson(
            '/api/department/documents?page=0',
            $this->authHeaders($staff)
        )->assertUnprocessable();
    }

    public function test_search_filters_safe_document_columns(): void
    {
        [$staff, $department] = $this->departmentStaff();

        $match = $this->document([
            'department_id' => $department->id,
            'title' => 'Needle Agreement',
            'tracking_number' => 'CONEXIA-NEEDLE',
        ]);

        $this->document([
            'department_id' => $department->id,
            'title' => 'Other Agreement',
            'tracking_number' => 'CONEXIA-OTHER',
        ]);

        $response = $this->getJson(
            '/api/department/documents?search=Needle',
            $this->authHeaders($staff)
        )->assertOk();

        $response->assertJsonPath('meta.total', 1);
        $this->assertSame($match->id, $response->json('data.0.id'));
    }

    public function test_status_filter_accepts_only_valid_workflow_statuses(): void
    {
        [$staff, $department] = $this->departmentStaff();

        $this->document([
            'department_id' => $department->id,
            'status' => Document::STATUS_SUBMITTED,
        ]);
        $this->document([
            'department_id' => $department->id,
            'status' => Document::STATUS_APPROVED,
        ]);

        $this->getJson(
            '/api/department/documents?status='.urlencode(Document::STATUS_APPROVED),
            $this->authHeaders($staff)
        )
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.status', Document::STATUS_APPROVED);

        $this->getJson(
            '/api/department/documents?status=Invalid',
            $this->authHeaders($staff)
        )->assertUnprocessable();
    }

    public function test_sort_columns_are_whitelisted(): void
    {
        [$staff] = $this->departmentStaff();

        $this->getJson(
            '/api/department/documents?sort=partner_email',
            $this->authHeaders($staff)
        )->assertUnprocessable();
    }

    public function test_role_scoping_is_preserved_with_pagination(): void
    {
        [$staff, $department] = $this->departmentStaff();
        $otherDepartment = $this->department(['code' => 'OTH']);

        $this->createDepartmentDocuments($department->id, 2);
        $this->createDepartmentDocuments($otherDepartment->id, 4);

        $response = $this->getJson(
            '/api/department/documents?per_page=100',
            $this->authHeaders($staff)
        )->assertOk();

        $response->assertJsonPath('meta.total', 2);

        $departmentIds = collect($response->json('data'))
            ->pluck('department_id')
            ->unique()
            ->values()
            ->all();

        $this->assertSame([$department->id], $departmentIds);
    }

    public function test_empty_pages_return_empty_data_with_meta(): void
    {
        [$staff, $department] = $this->departmentStaff();

        $this->createDepartmentDocuments($department->id, 2);

        $response = $this->getJson(
            '/api/department/documents?page=3&per_page=1',
            $this->authHeaders($staff)
        )->assertOk();

        $response
            ->assertJsonPath('meta.current_page', 3)
            ->assertJsonPath('meta.total', 2);

        $this->assertSame([], $response->json('data'));
    }

    public function test_notification_unread_count_stays_lightweight(): void
    {
        $user = $this->profile(Profile::ROLE_LEGAL_COUNSEL);

        for ($i = 1; $i <= 20; $i++) {
            $this->notification(['user_id' => $user->id]);
        }

        $this->getJson(
            '/api/notifications/unread-count',
            $this->authHeaders($user)
        )
            ->assertOk()
            ->assertJsonPath('count', 20)
            ->assertJsonMissingPath('notifications')
            ->assertJsonMissingPath('meta');
    }

    public function test_file_metadata_is_paginated_without_storage_fields(): void
    {
        [$staff, $department] = $this->departmentStaff();
        $document = $this->document([
            'department_id' => $department->id,
        ]);

        for ($i = 1; $i <= 3; $i++) {
            $this->documentFile([
                'document_id' => $document->id,
                'uploaded_by' => $staff->id,
                'original_filename' => "file-{$i}.pdf",
                'version' => $i,
            ]);
        }

        $response = $this->getJson(
            "/api/documents/{$document->id}/files?per_page=2",
            $this->authHeaders($staff)
        )->assertOk();

        $response
            ->assertJsonPath('meta.per_page', 2)
            ->assertJsonPath('meta.total', 3)
            ->assertJsonMissingPath('data.0.storage_path')
            ->assertJsonMissingPath('data.0.storage_disk');

        $this->assertCount(2, $response->json('data'));
    }

    private function departmentStaff(): array
    {
        $department = $this->department();
        $staff = $this->profile(
            Profile::ROLE_DEPARTMENT_STAFF,
            ['department_id' => $department->id]
        );

        return [$staff, $department];
    }

    private function createDepartmentDocuments(
        string $departmentId,
        int $count
    ): void {
        for ($i = 1; $i <= $count; $i++) {
            $this->document([
                'department_id' => $departmentId,
                'tracking_number' => sprintf(
                    'CONEXIA-PAGE-%s-%03d',
                    $departmentId,
                    $i
                ),
                'title' => "Paginated Agreement {$i}",
            ]);
        }
    }
}
