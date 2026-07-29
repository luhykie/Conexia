<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Services\NotificationService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class NotificationServiceTest extends TestCase
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
            $table->string('tracking_number');
            $table->string('title');
            $table->string('document_type');
            $table->string('partner_institution');
            $table->uuid('department_id');
            $table->uuid('submitted_by');
            $table->uuid('assigned_iro_staff')->nullable();
            $table->uuid('assigned_legal_counsel')->nullable();
            $table->string('status');
            $table->timestamp('submitted_at');
            $table->timestamp('updated_at');
        });
        Schema::create('workflow_events', function (Blueprint $table): void {
            $table->uuid('id')->nullable();
            $table->uuid('document_id');
            $table->string('event_type');
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

    public function test_new_document_notifies_active_iro_users_once(): void
    {
        $departmentId = (string) Str::uuid();
        $submitterId = (string) Str::uuid();
        $staffId = (string) Str::uuid();
        $adminId = (string) Str::uuid();

        DB::table('departments')->insert([
            'id' => $departmentId,
            'name' => 'School of Business and Management',
        ]);
        DB::table('profiles')->insert([
            [
                'id' => $submitterId,
                'role' => 'department_staff',
                'email' => 'department@example.test',
                'is_active' => true,
            ],
            [
                'id' => $staffId,
                'role' => 'iro_staff',
                'email' => 'staff@example.test',
                'is_active' => true,
            ],
            [
                'id' => $adminId,
                'role' => 'iro_admin',
                'email' => 'admin@example.test',
                'is_active' => true,
            ],
            [
                'id' => (string) Str::uuid(),
                'role' => 'iro_staff',
                'email' => 'inactive@example.test',
                'is_active' => false,
            ],
        ]);

        $document = Document::create([
            'tracking_number' => 'CONEXIA-2026-001',
            'title' => 'Partnership Agreement',
            'document_type' => 'MOA',
            'partner_institution' => 'Example University',
            'department_id' => $departmentId,
            'submitted_by' => $submitterId,
            'status' => 'Submitted',
            'submitted_at' => now(),
            'updated_at' => now(),
        ]);

        $service = app(NotificationService::class);
        $service->documentSubmitted($document);
        $service->documentSubmitted($document);

        $this->assertDatabaseCount('notifications', 2);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $staffId,
            'document_id' => $document->id,
            'type' => 'document_submitted',
            'is_read' => false,
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $adminId,
            'document_id' => $document->id,
            'type' => 'document_submitted',
            'is_read' => false,
        ]);
    }
}
