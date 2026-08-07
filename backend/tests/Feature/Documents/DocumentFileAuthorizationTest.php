<?php

namespace Tests\Feature\Documents;

use App\Models\AuditLog;
use App\Models\Document;
use App\Models\Profile;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Feature\Support\SecurityTestCase;

class DocumentFileAuthorizationTest extends SecurityTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
    }

    public function test_iro_staff_cannot_access_document_file_routes(): void
    {
        $iroStaff = $this->profile(Profile::ROLE_IRO_STAFF);
        $uploader = $this->profile(Profile::ROLE_IRO_ADMIN);
        $document = $this->document();
        $file = $this->documentFile([
            'document_id' => $document->id,
            'uploaded_by' => $uploader->id,
        ]);

        $this->getJson(
            "/api/documents/{$document->id}/files",
            $this->authHeaders($iroStaff)
        )->assertForbidden();

        $this->postJson(
            "/api/documents/{$document->id}/files",
            [
                'file' => UploadedFile::fake()
                    ->create('agreement.pdf', 12, 'application/pdf'),
            ],
            $this->authHeaders($iroStaff)
        )->assertForbidden();

        $this->getJson(
            "/api/documents/{$document->id}/files/{$file->id}/download",
            $this->authHeaders($iroStaff)
        )->assertForbidden();

        $this->getJson(
            "/api/documents/{$document->id}/files/{$file->id}/preview",
            $this->authHeaders($iroStaff)
        )->assertForbidden();

        $this->deleteJson(
            "/api/documents/{$document->id}/files/{$file->id}",
            [],
            $this->authHeaders($iroStaff)
        )->assertForbidden();
    }

    public function test_authorised_department_staff_can_upload_document_file(): void
    {
        $department = $this->department();
        $staff = $this->profile(
            Profile::ROLE_DEPARTMENT_STAFF,
            ['department_id' => $department->id]
        );
        $document = $this->document([
            'department_id' => $department->id,
            'status' => Document::STATUS_SUBMITTED,
        ]);

        $response = $this->postJson(
            "/api/documents/{$document->id}/files",
            [
                'file' => UploadedFile::fake()
                    ->create(
                        'partnership agreement.pdf',
                        12,
                        'application/pdf'
                    ),
            ],
            $this->authHeaders($staff)
        );

        $response
            ->assertCreated()
            ->assertJsonPath('file.filename', 'partnership agreement.pdf')
            ->assertJsonMissingPath('file.storage_path');

        $this->assertCount(
            1,
            Storage::disk('local')
                ->allFiles('documents/'.$document->id)
        );

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'document_file.uploaded',
            'document_id' => $document->id,
            'actor_id' => $staff->id,
        ]);
    }

    public function test_unauthorised_user_cannot_upload_to_another_department_document(): void
    {
        $ownDepartment = $this->department(['code' => 'OWN']);
        $otherDepartment = $this->department(['code' => 'OTH']);
        $staff = $this->profile(
            Profile::ROLE_DEPARTMENT_STAFF,
            ['department_id' => $ownDepartment->id]
        );
        $document = $this->document([
            'department_id' => $otherDepartment->id,
        ]);

        $this->postJson(
            "/api/documents/{$document->id}/files",
            [
                'file' => UploadedFile::fake()
                    ->create('agreement.pdf', 12, 'application/pdf'),
            ],
            $this->authHeaders($staff)
        )->assertNotFound();
    }

    public function test_invalid_file_type_is_rejected(): void
    {
        $department = $this->department();
        $staff = $this->profile(
            Profile::ROLE_DEPARTMENT_STAFF,
            ['department_id' => $department->id]
        );
        $document = $this->document([
            'department_id' => $department->id,
        ]);

        $this->postJson(
            "/api/documents/{$document->id}/files",
            [
                'file' => UploadedFile::fake()
                    ->create('payload.exe', 4, 'application/x-msdownload'),
            ],
            $this->authHeaders($staff)
        )->assertUnprocessable();
    }

    public function test_oversized_file_is_rejected(): void
    {
        $department = $this->department();
        $staff = $this->profile(
            Profile::ROLE_DEPARTMENT_STAFF,
            ['department_id' => $department->id]
        );
        $document = $this->document([
            'department_id' => $department->id,
        ]);

        $this->postJson(
            "/api/documents/{$document->id}/files",
            [
                'file' => UploadedFile::fake()
                    ->create('large.pdf', 26000, 'application/pdf'),
            ],
            $this->authHeaders($staff)
        )->assertUnprocessable();
    }

    public function test_download_requires_document_permission_and_logs_access(): void
    {
        $department = $this->department();
        $staff = $this->profile(
            Profile::ROLE_DEPARTMENT_STAFF,
            ['department_id' => $department->id]
        );
        $document = $this->document([
            'department_id' => $department->id,
        ]);

        Storage::disk('local')->put(
            'documents/test/agreement.pdf',
            'secret file'
        );

        $file = $this->documentFile([
            'document_id' => $document->id,
            'uploaded_by' => $staff->id,
            'storage_path' => 'documents/test/agreement.pdf',
            'size' => strlen('secret file'),
        ]);

        $this->getJson(
            "/api/documents/{$document->id}/files/{$file->id}/download",
            $this->authHeaders($staff)
        )->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'document_file.downloaded',
            'document_file_id' => $file->id,
            'actor_id' => $staff->id,
        ]);
    }

    public function test_preview_requires_permission_and_supported_type(): void
    {
        $legal = $this->profile(Profile::ROLE_LEGAL_COUNSEL);
        $document = $this->document([
            'assigned_legal_counsel' => $legal->id,
        ]);

        Storage::disk('local')->put(
            'documents/test/preview.pdf',
            'preview'
        );

        $file = $this->documentFile([
            'document_id' => $document->id,
            'uploaded_by' => $legal->id,
            'storage_path' => 'documents/test/preview.pdf',
            'size' => strlen('preview'),
        ]);

        $this->getJson(
            "/api/documents/{$document->id}/files/{$file->id}/preview",
            $this->authHeaders($legal)
        )->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'document_file.previewed',
            'document_file_id' => $file->id,
        ]);
    }

    public function test_delete_requires_permission_workflow_and_logs_deletion(): void
    {
        $department = $this->department();
        $staff = $this->profile(
            Profile::ROLE_DEPARTMENT_STAFF,
            ['department_id' => $department->id]
        );
        $document = $this->document([
            'department_id' => $department->id,
            'status' => Document::STATUS_SUBMITTED,
        ]);

        Storage::disk('local')->put(
            'documents/test/delete.pdf',
            'delete me'
        );

        $file = $this->documentFile([
            'document_id' => $document->id,
            'uploaded_by' => $staff->id,
            'storage_path' => 'documents/test/delete.pdf',
        ]);

        $this->deleteJson(
            "/api/documents/{$document->id}/files/{$file->id}",
            [],
            $this->authHeaders($staff)
        )->assertOk();

        Storage::disk('local')->assertMissing(
            'documents/test/delete.pdf'
        );

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'document_file.deleted',
            'document_file_id' => $file->id,
        ]);
    }

    public function test_delete_rejects_locked_workflow_stage(): void
    {
        $department = $this->department();
        $staff = $this->profile(
            Profile::ROLE_DEPARTMENT_STAFF,
            ['department_id' => $department->id]
        );
        $document = $this->document([
            'department_id' => $department->id,
            'status' => Document::STATUS_APPROVED,
        ]);
        $file = $this->documentFile([
            'document_id' => $document->id,
            'uploaded_by' => $staff->id,
        ]);

        $this->deleteJson(
            "/api/documents/{$document->id}/files/{$file->id}",
            [],
            $this->authHeaders($staff)
        )->assertUnprocessable();
    }

    public function test_metadata_does_not_expose_storage_implementation(): void
    {
        $department = $this->department();
        $staff = $this->profile(
            Profile::ROLE_DEPARTMENT_STAFF,
            ['department_id' => $department->id]
        );
        $document = $this->document([
            'department_id' => $department->id,
        ]);
        $this->documentFile([
            'document_id' => $document->id,
            'uploaded_by' => $staff->id,
            'storage_path' => 'documents/private/path.pdf',
        ]);

        $this->getJson(
            "/api/documents/{$document->id}/files",
            $this->authHeaders($staff)
        )
            ->assertOk()
            ->assertJsonMissingPath('files.0.storage_path')
            ->assertJsonMissingPath('files.0.storage_disk');

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'document_file.metadata',
            'document_id' => $document->id,
        ]);
    }
}
