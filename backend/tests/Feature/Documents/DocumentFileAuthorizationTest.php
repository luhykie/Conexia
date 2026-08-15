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
        $document = $this->document([
            'status' => Document::STATUS_LOGGED,
        ]);
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

    public function test_only_iro_admin_can_add_and_view_file_annotations(): void
    {
        $iroAdmin = $this->profile(Profile::ROLE_IRO_ADMIN);
        $legal = $this->profile(Profile::ROLE_LEGAL_COUNSEL);
        $document = $this->document([
            'status' => Document::STATUS_LOGGED,
        ]);
        Storage::disk('local')->put('documents/test/annotate.pdf', 'review');
        $file = $this->documentFile([
            'document_id' => $document->id,
            'uploaded_by' => $iroAdmin->id,
            'storage_path' => 'documents/test/annotate.pdf',
        ]);
        $url = "/api/documents/{$document->id}/files/{$file->id}/annotations";

        $this->postJson(
            $url,
            [
                'highlight' => 'Section 4.2, page 3',
                'comment' => 'Confirm the renewal notice period.',
                'geometry' => [
                    'page' => 3,
                    'rects' => [[
                        'x' => 0.1,
                        'y' => 0.2,
                        'width' => 0.3,
                        'height' => 0.1,
                    ]],
                ],
            ],
            $this->authHeaders($iroAdmin)
        )
            ->assertCreated()
            ->assertJsonPath('annotation.highlight', 'Section 4.2, page 3')
            ->assertJsonPath(
                'annotation.comment',
                'Confirm the renewal notice period.'
            )
            ->assertJsonPath('annotation.version', $file->version)
            ->assertJsonPath('annotation.geometry.page', 3)
            ->assertJsonPath('annotation.geometry.rects.0.x', 0.1);

        $this->getJson($url, $this->authHeaders($iroAdmin))
            ->assertOk()
            ->assertJsonCount(1, 'annotations')
            ->assertJsonPath('annotations.0.author', $iroAdmin->full_name)
            ->assertJsonPath('annotations.0.reviewer_id', $iroAdmin->id)
            ->assertJsonPath('annotations.0.document_id', $document->id)
            ->assertJsonPath('annotations.0.document_file_id', $file->id)
            ->assertJsonPath(
                'annotations.0.comment',
                'Confirm the renewal notice period.'
            );

        $this->getJson($url, $this->authHeaders($legal))
            ->assertForbidden();

        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => $iroAdmin->id,
            'document_id' => $document->id,
            'document_file_id' => $file->id,
            'action' => 'document_file.annotated',
        ]);
    }

    public function test_iro_admin_cannot_annotate_document_outside_logged_review_stage(): void
    {
        $iroAdmin = $this->profile(Profile::ROLE_IRO_ADMIN);
        $document = $this->document([
            'status' => Document::STATUS_SUBMITTED,
        ]);
        Storage::disk('local')->put('documents/test/ineligible.pdf', 'review');
        $file = $this->documentFile([
            'document_id' => $document->id,
            'uploaded_by' => $iroAdmin->id,
            'storage_path' => 'documents/test/ineligible.pdf',
        ]);

        $this->postJson(
            "/api/documents/{$document->id}/files/{$file->id}/annotations",
            [
                'highlight' => 'Area highlight',
                'comment' => 'This must not be saved.',
                'geometry' => [
                    'page' => 1,
                    'rects' => [[
                        'x' => 0.1,
                        'y' => 0.1,
                        'width' => 0.2,
                        'height' => 0.2,
                    ]],
                ],
            ],
            $this->authHeaders($iroAdmin)
        )->assertNotFound();

        $this->assertDatabaseMissing('audit_logs', [
            'document_id' => $document->id,
            'action' => 'document_file.annotated',
        ]);
    }

    public function test_iro_admin_can_edit_and_remove_annotations_only_during_active_review(): void
    {
        $admin = $this->profile(Profile::ROLE_IRO_ADMIN);
        $document = $this->document(['status' => Document::STATUS_LOGGED]);
        Storage::disk('local')->put('documents/test/manage-annotation.pdf', 'review');
        $file = $this->documentFile([
            'document_id' => $document->id,
            'uploaded_by' => $admin->id,
            'storage_path' => 'documents/test/manage-annotation.pdf',
        ]);
        $url = "/api/documents/{$document->id}/files/{$file->id}/annotations";

        $createdResponse = $this->postJson($url, [
            'highlight' => 'Selected agreement text',
            'comment' => 'Original comment.',
            'geometry' => [
                'page' => 1,
                'rects' => [['x' => .1, 'y' => .2, 'width' => .3, 'height' => .03]],
            ],
        ], $this->authHeaders($admin))->assertCreated();
        $annotationId = $createdResponse->json('annotation.id');
        $createdAt = $createdResponse->json('annotation.created_at');

        $managementUrl = "{$url}/{$annotationId}";
        $this->patchJson(
            $managementUrl,
            ['comment' => 'Corrected persistent comment.'],
            $this->authHeaders($admin)
        )->assertOk()
            ->assertJsonPath('annotation.comment', 'Corrected persistent comment.')
            ->assertJsonPath('annotation.id', $annotationId)
            ->assertJsonPath('annotation.updated_at', fn ($value) => is_string($value));

        $this->getJson($url, $this->authHeaders($admin))
            ->assertOk()
            ->assertJsonCount(1, 'annotations')
            ->assertJsonPath('annotations.0.id', $annotationId)
            ->assertJsonPath('annotations.0.comment', 'Corrected persistent comment.')
            ->assertJsonPath('annotations.0.created_at', $createdAt)
            ->assertJsonPath('annotations.0.updated_at', fn ($value) => is_string($value))
            ->assertJsonPath('annotations.0.geometry.page', 1);

        $this->assertDatabaseHas('audit_logs', [
            'document_id' => $document->id,
            'document_file_id' => $file->id,
            'action' => 'document_file.annotation_comment_updated',
        ]);

        $this->deleteJson($managementUrl, [], $this->authHeaders($admin))
            ->assertOk()
            ->assertJsonPath('annotation.id', $annotationId);

        $this->getJson($url, $this->authHeaders($admin))
            ->assertOk()
            ->assertJsonCount(0, 'annotations');
        $this->assertDatabaseHas('audit_logs', ['id' => $annotationId, 'action' => 'document_file.annotated']);
        $this->assertDatabaseHas('audit_logs', [
            'document_id' => $document->id,
            'action' => 'document_file.annotation_removed',
        ]);
        $this->patchJson(
            $managementUrl,
            ['comment' => 'Removed annotations cannot be changed.'],
            $this->authHeaders($admin)
        )->assertNotFound();
    }

    public function test_annotation_management_is_locked_after_admin_review(): void
    {
        $admin = $this->profile(Profile::ROLE_IRO_ADMIN);
        foreach ([Document::STATUS_CORRECTIONS_NEEDED, Document::STATUS_UNDER_LEGAL_REVIEW] as $status) {
            $document = $this->document(['status' => $status]);
            Storage::disk('local')->put("documents/test/locked-{$document->id}.pdf", 'review');
            $file = $this->documentFile([
                'document_id' => $document->id,
                'uploaded_by' => $admin->id,
                'storage_path' => "documents/test/locked-{$document->id}.pdf",
            ]);
            $annotation = AuditLog::query()->create([
                'actor_id' => $admin->id,
                'document_id' => $document->id,
                'document_file_id' => $file->id,
                'action' => 'document_file.annotated',
                'metadata' => [
                    'highlight' => 'Locked selection',
                    'comment' => 'Historical comment.',
                    'version' => 1,
                    'geometry' => ['page' => 1, 'rects' => [['x' => .1, 'y' => .1, 'width' => .2, 'height' => .03]]],
                ],
            ]);
            $url = "/api/documents/{$document->id}/files/{$file->id}/annotations/{$annotation->id}";

            $this->patchJson($url, ['comment' => 'Forbidden edit.'], $this->authHeaders($admin))
                ->assertNotFound();
            $this->deleteJson($url, [], $this->authHeaders($admin))
                ->assertNotFound();
        }
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
