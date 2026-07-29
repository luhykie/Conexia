<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\DocumentController;
use App\Models\Document;
use App\Models\DocumentFile;
use App\Services\NotificationService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Tests\TestCase;

class DocumentSubmissionFileTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('departments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name');
        });
        Schema::create('profiles', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('role');
            $table->string('full_name')->nullable();
            $table->string('email');
            $table->boolean('is_active')->default(true);
            $table->uuid('department_id')->nullable();
        });
        Schema::create('documents', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('tracking_number')->unique();
            $table->string('title');
            $table->string('document_type');
            $table->string('partner_institution');
            $table->string('partner_email')->nullable();
            $table->text('description')->nullable();
            $table->uuid('department_id');
            $table->uuid('submitted_by');
            $table->uuid('assigned_iro_staff')->nullable();
            $table->uuid('assigned_legal_counsel')->nullable();
            $table->string('status');
            $table->text('legal_notes')->nullable();
            $table->timestamp('submitted_at');
            $table->timestamp('updated_at');
        });
        Schema::create('document_files', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('document_id');
            $table->uuid('uploaded_by');
            $table->string('file_category');
            $table->string('original_filename');
            $table->string('stored_filename');
            $table->string('storage_disk');
            $table->string('storage_path');
            $table->string('mime_type');
            $table->unsignedBigInteger('size');
            $table->unsignedInteger('version');
            $table->timestamps();
        });
        Schema::create('workflow_events', function (Blueprint $table): void {
            $table->uuid('id')->nullable();
            $table->uuid('document_id');
            $table->uuid('actor_id');
            $table->string('actor_role');
            $table->string('event_type');
            $table->string('from_status')->nullable();
            $table->string('to_status');
            $table->text('notes')->nullable();
            $table->timestamp('created_at');
        });
        Schema::create('notifications', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->uuid('document_id')->nullable();
            $table->string('type');
            $table->string('title');
            $table->text('message');
            $table->string('dedupe_key')->nullable()->unique();
            $table->boolean('is_read')->default(false);
            $table->timestamp('created_at');
            $table->timestamp('read_at')->nullable();
        });
    }

    public function test_department_staff_submission_stores_original_draft_privately(): void
    {
        Storage::fake('local');

        $departmentId = (string) Str::uuid();
        $staffId = (string) Str::uuid();

        DB::table('departments')->insert([
            'id' => $departmentId,
            'name' => 'College of Engineering',
        ]);
        DB::table('profiles')->insert([
            'id' => $staffId,
            'role' => 'department_staff',
            'email' => 'department@example.test',
            'is_active' => true,
            'department_id' => $departmentId,
        ]);

        $request = Request::create(
            '/api/documents',
            'POST',
            [
                'tracking_number' => 'CONEXIA-FILE-001',
                'title' => 'Partner University MOA',
                'document_type' => 'MOA',
                'partner_institution' => 'Partner University',
                'partner_email' => 'partner@example.test',
                'description' => 'Original agreement draft.',
            ],
            [],
            [
                'file' => UploadedFile::fake()->create(
                    'agreement.pdf',
                    500,
                    'application/pdf'
                ),
            ]
        );
        $request->attributes->set('auth_profile', (object) [
            'id' => $staffId,
            'role' => 'department_staff',
            'department_id' => $departmentId,
        ]);

        $response = app(DocumentController::class)->store($request);

        $this->assertSame(201, $response->getStatusCode());
        $fileRecord = DB::table('document_files')->first();
        $this->assertNotNull($fileRecord);
        $this->assertSame('original_draft', $fileRecord->file_category);
        $this->assertSame('agreement.pdf', $fileRecord->original_filename);
        $this->assertSame(1, $fileRecord->version);
        Storage::disk('local')->assertExists($fileRecord->storage_path);
        $this->assertDatabaseHas('workflow_events', [
            'event_type' => 'document_submitted',
            'notes' => 'Original draft uploaded: agreement.pdf',
        ]);

        $document = Document::query()->firstOrFail();
        $documentFile = DocumentFile::query()->firstOrFail();
        $iroRequest = Request::create('/file', 'GET');
        $iroRequest->attributes->set('auth_profile', (object) [
            'id' => (string) Str::uuid(),
            'role' => 'iro_staff',
            'department_id' => null,
        ]);

        $viewResponse = app(DocumentController::class)->viewFile(
            $iroRequest,
            $document,
            $documentFile
        );

        $this->assertSame(200, $viewResponse->getStatusCode());
        $this->assertStringStartsWith(
            'inline;',
            $viewResponse->headers->get('Content-Disposition')
        );

        $otherDepartmentRequest = Request::create('/file', 'GET');
        $otherDepartmentRequest->attributes->set('auth_profile', (object) [
            'id' => (string) Str::uuid(),
            'role' => 'department_staff',
            'department_id' => (string) Str::uuid(),
        ]);

        $this->expectException(NotFoundHttpException::class);
        app(DocumentController::class)->viewFile(
            $otherDepartmentRequest,
            $document,
            $documentFile
        );
    }
}
