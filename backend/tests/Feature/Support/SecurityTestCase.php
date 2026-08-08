<?php

namespace Tests\Feature\Support;

use App\Models\Department;
use App\Models\Document;
use App\Models\DocumentFile;
use App\Models\Notification;
use App\Models\Profile;
use App\Services\SupabaseAuthService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

abstract class SecurityTestCase extends TestCase
{
    private array $authTokens = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->setUpSecurityTables();
        $this->fakeSupabaseAuth();
    }

    protected function profile(
        string $role,
        array $overrides = []
    ): Profile {
        return Profile::query()->create([
            'id' => $overrides['id'] ?? (string) Str::uuid(),
            'full_name' => $overrides['full_name'] ??
                str_replace('_', ' ', $role),
            'email' => $overrides['email'] ??
                Str::uuid().'@conexia.test',
            'role' => $role,
            'department_id' => $overrides['department_id'] ?? null,
            'is_active' => $overrides['is_active'] ?? true,
        ]);
    }

    protected function department(
        array $overrides = []
    ): Department {
        return Department::query()->create([
            'id' => $overrides['id'] ?? (string) Str::uuid(),
            'name' => $overrides['name'] ?? 'School of Testing',
            'code' => $overrides['code'] ?? 'TST',
            'email' => $overrides['email'] ?? null,
        ]);
    }

    protected function document(
        array $overrides = []
    ): Document {
        return Document::query()->create([
            'id' => $overrides['id'] ?? (string) Str::uuid(),
            'tracking_number' => $overrides['tracking_number'] ??
                'CONEXIA-TEST-'.Str::uuid(),
            'title' => $overrides['title'] ?? 'Test Agreement',
            'document_type' => $overrides['document_type'] ?? 'MOA',
            'partner_institution' =>
                $overrides['partner_institution'] ?? 'ABC Company',
            'partner_email' => $overrides['partner_email'] ?? null,
            'description' => $overrides['description'] ?? null,
            'department_id' => $overrides['department_id'] ?? null,
            'submitted_by' => $overrides['submitted_by'] ?? null,
            'assigned_legal_counsel' =>
                $overrides['assigned_legal_counsel'] ?? null,
            'status' => $overrides['status'] ??
                Document::STATUS_SUBMITTED,
            'legal_notes' => $overrides['legal_notes'] ?? null,
            'notarial_reference_number' =>
                $overrides['notarial_reference_number'] ?? null,
            'notarization_date' =>
                $overrides['notarization_date'] ?? null,
            'notary_signature_code' =>
                $overrides['notary_signature_code'] ?? null,
            'archived_at' => $overrides['archived_at'] ?? null,
            'archived_by' => $overrides['archived_by'] ?? null,
            'effective_date' =>
                $overrides['effective_date'] ?? null,
            'expiry_date' => $overrides['expiry_date'] ?? null,
            'renewal_notice_days' =>
                $overrides['renewal_notice_days'] ?? null,
            'renewal_status' => $overrides['renewal_status'] ??
                Document::RENEWAL_NOT_REQUIRED,
        ]);
    }

    protected function notification(
        array $overrides = []
    ): Notification {
        return Notification::query()->create([
            'id' => $overrides['id'] ?? (string) Str::uuid(),
            'user_id' => $overrides['user_id'],
            'document_id' => $overrides['document_id'] ?? null,
            'title' => $overrides['title'] ?? 'Workflow Update',
            'message' => $overrides['message'] ?? 'A document changed.',
            'notification_type' =>
                $overrides['notification_type'] ?? 'document_update',
            'is_read' => $overrides['is_read'] ?? false,
            'read_at' => $overrides['read_at'] ?? null,
        ]);
    }

    protected function documentFile(
        array $overrides = []
    ): DocumentFile {
        return DocumentFile::query()->create([
            'id' => $overrides['id'] ?? (string) Str::uuid(),
            'document_id' => $overrides['document_id'],
            'uploaded_by' => $overrides['uploaded_by'],
            'original_filename' =>
                $overrides['original_filename'] ?? 'agreement.pdf',
            'stored_filename' =>
                $overrides['stored_filename'] ?? Str::uuid().'.pdf',
            'storage_disk' => $overrides['storage_disk'] ?? 'local',
            'storage_path' => $overrides['storage_path'] ??
                'documents/test/agreement.pdf',
            'mime_type' => $overrides['mime_type'] ?? 'application/pdf',
            'size' => $overrides['size'] ?? 128,
            'version' => $overrides['version'] ?? 1,
            'deleted_at' => $overrides['deleted_at'] ?? null,
        ]);
    }

    protected function tokenFor(Profile $profile): string
    {
        $token = 'valid-'.$profile->id;

        $this->authTokens[$token] = [
            'id' => $profile->id,
            'email' => $profile->email,
        ];

        $this->fakeSupabaseAuth();

        return $token;
    }

    protected function authHeaders(Profile $profile): array
    {
        return [
            'Authorization' => 'Bearer '.$this->tokenFor($profile),
        ];
    }

    protected function expiredToken(): string
    {
        $this->authTokens['expired-token'] = [];
        $this->fakeSupabaseAuth();

        return 'expired-token';
    }

    protected function invalidToken(): string
    {
        return 'invalid-token';
    }

    private function fakeSupabaseAuth(): void
    {
        $this->app->instance(
            SupabaseAuthService::class,
            new FakeSupabaseAuthService($this->authTokens)
        );
    }

    private function setUpSecurityTables(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('document_files');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('documents');
        Schema::dropIfExists('profiles');
        Schema::dropIfExists('departments');

        Schema::create('departments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('code');
            $table->string('email')->nullable();
        });

        Schema::create('profiles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('full_name');
            $table->string('email')->unique();
            $table->string('role');
            $table->uuid('department_id')->nullable();
            $table->boolean('is_active')->default(true);
        });

        Schema::create('documents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('tracking_number')->nullable()->unique();
            $table->string('title')->nullable();
            $table->string('document_type')->nullable();
            $table->string('partner_institution')->nullable();
            $table->string('partner_email')->nullable();
            $table->text('description')->nullable();
            $table->uuid('department_id')->nullable();
            $table->uuid('submitted_by')->nullable();
            $table->uuid('assigned_legal_counsel')->nullable();
            $table->string('status');
            $table->text('legal_notes')->nullable();
            $table->string('notarial_reference_number')->nullable();
            $table->date('notarization_date')->nullable();
            $table->string('notary_signature_code')->nullable();
            $table->timestamp('archived_at')->nullable();
            $table->uuid('archived_by')->nullable();
            $table->date('effective_date')->nullable();
            $table->date('expiry_date')->nullable();
            $table->unsignedInteger('renewal_notice_days')->nullable();
            $table->string('renewal_status')
                ->default(Document::RENEWAL_NOT_REQUIRED);
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->uuid('document_id')->nullable();
            $table->string('title');
            $table->text('message');
            $table->string('notification_type');
            $table->boolean('is_read')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('document_files', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('document_id');
            $table->uuid('uploaded_by');
            $table->string('original_filename');
            $table->string('stored_filename');
            $table->string('storage_disk');
            $table->string('storage_path');
            $table->string('mime_type');
            $table->unsignedBigInteger('size');
            $table->unsignedInteger('version')->default(1);
            $table->timestamp('deleted_at')->nullable();
            $table->timestamps();
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('actor_id')->nullable();
            $table->uuid('document_id')->nullable();
            $table->uuid('document_file_id')->nullable();
            $table->string('action');
            $table->json('metadata')->nullable();
            $table->timestamp('created_at')->nullable();
        });
    }
}
