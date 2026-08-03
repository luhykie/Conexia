<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\DocumentController;
use App\Http\Controllers\Api\IroAdminController;
use App\Http\Controllers\Api\ReviewFormController;
use App\Models\Document;
use App\Models\ReviewForm;
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

class ReviewFormWorkflowTest extends TestCase
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
            $table->string('notarial_reference_number')->nullable();
            $table->date('notarization_date')->nullable();
            $table->string('notary_signature_code')->nullable();
            $table->timestamp('submitted_at');
            $table->timestamp('updated_at');
        });
        Schema::create('review_forms', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('document_id')->unique();
            $table->json('checklist_answers');
            $table->text('staff_remarks')->nullable();
            $table->string('review_form_status');
            $table->uuid('prepared_by');
            $table->timestamp('submitted_at')->nullable();
            $table->text('admin_remarks')->nullable();
            $table->uuid('validated_by')->nullable();
            $table->timestamp('validated_at')->nullable();
            $table->text('sent_back_reason')->nullable();
            $table->uuid('sent_back_by')->nullable();
            $table->timestamp('sent_back_at')->nullable();
            $table->timestamps();
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

    public function test_form_must_be_submitted_and_validated_before_legal_routing(): void
    {
        $departmentId = (string) Str::uuid();
        $submitterId = (string) Str::uuid();
        $staffId = (string) Str::uuid();
        $adminId = (string) Str::uuid();
        $legalId = (string) Str::uuid();

        DB::table('departments')->insert([
            'id' => $departmentId,
            'name' => 'School of Business and Management',
        ]);
        DB::table('profiles')->insert([
            ['id' => $submitterId, 'role' => 'department_staff', 'email' => 'department@example.test', 'is_active' => true],
            ['id' => $staffId, 'role' => 'iro_staff', 'email' => 'staff@example.test', 'is_active' => true],
            ['id' => $adminId, 'role' => 'iro_admin', 'email' => 'admin@example.test', 'is_active' => true],
            ['id' => $legalId, 'role' => 'legal_counsel', 'email' => 'legal@example.test', 'is_active' => true],
        ]);

        $document = Document::create([
            'tracking_number' => 'CONEXIA-2026-REVIEW-1',
            'title' => 'Review Workflow',
            'document_type' => 'MOA',
            'partner_institution' => 'Example University',
            'department_id' => $departmentId,
            'submitted_by' => $submitterId,
            'status' => 'Submitted',
            'submitted_at' => now(),
            'updated_at' => now(),
        ]);
        $notifications = app(NotificationService::class);
        $reviewController = new ReviewFormController($notifications);
        $documentController = new DocumentController($notifications);

        $prematureRoute = $documentController->routeToLegal(
            $this->request(['legal_counsel_id' => $legalId], $adminId, 'iro_admin'),
            $document
        );
        $this->assertSame(422, $prematureRoute->getStatusCode());

        $reviewController->submit(
            $this->request([
                'staff_remarks' => 'Logged and ready for administrative validation.',
            ], $staffId, 'iro_staff'),
            $document
        );
        $this->assertSame('Review Form Submitted', $document->fresh()->status);
        $this->assertSame(
            array_fill_keys(['signatures', 'terms', 'attachments', 'gdpr'], false),
            $document->fresh()->reviewForm->checklist_answers
        );

        $reviewController->validateReview(
            $this->request([
                'admin_remarks' => 'Validated by IRO Admin.',
                'checklist_answers' => [
                    'signatures' => true,
                    'terms' => true,
                    'attachments' => true,
                    'gdpr' => true,
                ],
            ], $adminId, 'iro_admin'),
            $document->fresh()
        );

        $form = ReviewForm::query()->where('document_id', $document->id)->firstOrFail();
        $this->assertSame('validated', $form->review_form_status);
        $this->assertSame($adminId, $form->validated_by);
        $this->assertNotNull($form->validated_at);

        $response = $documentController->routeToLegal(
            $this->request(['legal_counsel_id' => $legalId], $adminId, 'iro_admin'),
            $document->fresh()
        );

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('Under Legal Review', $document->fresh()->status);

        $legalQueue = $documentController->legalReviewQueue(
            $this->request([], $legalId, 'legal_counsel')
        );
        $queueData = json_decode($legalQueue->getContent(), true)['data'];

        $this->assertCount(1, $queueData);
        $this->assertSame(
            'validated',
            $queueData[0]['review_form']['review_form_status']
        );
        $this->assertSame(
            'Validated by IRO Admin.',
            $queueData[0]['review_form']['admin_remarks']
        );

        $approval = $documentController->approve(
            $this->request([], $legalId, 'legal_counsel'),
            $document->fresh()
        );

        $this->assertSame(200, $approval->getStatusCode());
        $this->assertSame('Approved', $document->fresh()->status);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $adminId,
            'document_id' => $document->id,
            'type' => 'legal_approved',
            'title' => 'Document Approved by Legal Counsel',
        ]);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $staffId,
            'document_id' => $document->id,
            'type' => 'legal_approved',
            'title' => 'Document Approved by Legal Counsel',
        ]);
    }

    public function test_admin_can_send_submitted_form_back_with_persisted_reason(): void
    {
        $departmentId = (string) Str::uuid();
        $submitterId = (string) Str::uuid();
        $staffId = (string) Str::uuid();
        $adminId = (string) Str::uuid();

        DB::table('departments')->insert([
            'id' => $departmentId,
            'name' => 'School of Engineering',
        ]);
        DB::table('profiles')->insert([
            ['id' => $submitterId, 'role' => 'department_staff', 'email' => 'department@example.test', 'is_active' => true],
            ['id' => $staffId, 'role' => 'iro_staff', 'email' => 'staff@example.test', 'is_active' => true],
            ['id' => $adminId, 'role' => 'iro_admin', 'email' => 'admin@example.test', 'is_active' => true],
        ]);
        $document = Document::create([
            'tracking_number' => 'CONEXIA-2026-REVIEW-2',
            'title' => 'Incomplete Review Workflow',
            'document_type' => 'MOU',
            'partner_institution' => 'Example College',
            'department_id' => $departmentId,
            'submitted_by' => $submitterId,
            'status' => 'Submitted',
            'submitted_at' => now(),
            'updated_at' => now(),
        ]);
        $controller = new ReviewFormController(app(NotificationService::class));
        $controller->submit(
            $this->request([
                'checklist_answers' => [
                    'signatures' => false,
                    'terms' => true,
                    'attachments' => true,
                    'gdpr' => true,
                ],
                'staff_remarks' => 'Signature is pending.',
            ], $staffId, 'iro_staff'),
            $document
        );

        $controller->sendBack(
            $this->request([
                'reason' => 'Obtain the missing authorized signature.',
                'admin_remarks' => 'Resubmit after correction.',
            ], $adminId, 'iro_admin'),
            $document->fresh()
        );

        $form = ReviewForm::query()->where('document_id', $document->id)->firstOrFail();
        $this->assertSame('sent_back', $form->review_form_status);
        $this->assertSame('Obtain the missing authorized signature.', $form->sent_back_reason);
        $this->assertSame($adminId, $form->sent_back_by);
        $this->assertNotNull($form->sent_back_at);
        $this->assertSame('Review Form Sent Back', $document->fresh()->status);
    }

    public function test_admin_can_reassign_submission_between_active_iro_staff(): void
    {
        $departmentId = (string) Str::uuid();
        $submitterId = (string) Str::uuid();
        $previousStaffId = (string) Str::uuid();
        $newStaffId = (string) Str::uuid();
        $adminId = (string) Str::uuid();

        DB::table('departments')->insert([
            'id' => $departmentId,
            'name' => 'International Programs',
        ]);
        DB::table('profiles')->insert([
            ['id' => $submitterId, 'role' => 'department_staff', 'full_name' => null, 'email' => 'department@example.test', 'is_active' => true],
            ['id' => $previousStaffId, 'role' => 'iro_staff', 'full_name' => 'Previous Staff', 'email' => 'previous@example.test', 'is_active' => true],
            ['id' => $newStaffId, 'role' => 'iro_staff', 'full_name' => 'New Staff', 'email' => 'new@example.test', 'is_active' => true],
            ['id' => $adminId, 'role' => 'iro_admin', 'full_name' => null, 'email' => 'admin@example.test', 'is_active' => true],
        ]);

        $document = Document::create([
            'tracking_number' => 'CONEXIA-REASSIGN-001',
            'title' => 'Reassignment Workflow',
            'document_type' => 'MOU',
            'partner_institution' => 'Partner Institute',
            'department_id' => $departmentId,
            'submitted_by' => $submitterId,
            'assigned_iro_staff' => $previousStaffId,
            'status' => 'Logged',
            'submitted_at' => now(),
            'updated_at' => now(),
        ]);
        $controller = app(IroAdminController::class);

        $response = $controller->reassign(
            $this->request(
                [
                    'iro_staff_id' => $newStaffId,
                    'reason' => 'Balance the active review workload.',
                ],
                $adminId,
                'iro_admin'
            ),
            $document
        );

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame(
            $newStaffId,
            $document->fresh()->assigned_iro_staff
        );
        $this->assertDatabaseHas('workflow_events', [
            'document_id' => $document->id,
            'actor_id' => $adminId,
            'event_type' => 'submission_reassigned',
            'notes' => 'IRO Staff assignment changed from Previous Staff to New Staff. Reason: Balance the active review workload.',
        ]);
        $this->assertDatabaseHas('notifications', [
            'document_id' => $document->id,
            'user_id' => $previousStaffId,
            'type' => 'submission_reassigned',
        ]);
        $this->assertDatabaseHas('notifications', [
            'document_id' => $document->id,
            'user_id' => $newStaffId,
            'type' => 'submission_reassigned',
        ]);

        $sameStaffResponse = $controller->reassign(
            $this->request(
                [
                    'iro_staff_id' => $newStaffId,
                    'reason' => 'Balance the active review workload.',
                ],
                $adminId,
                'iro_admin'
            ),
            $document->fresh()
        );
        $this->assertSame(422, $sameStaffResponse->getStatusCode());
    }

    public function test_previous_assignee_cannot_process_a_reassigned_submission(): void
    {
        $departmentId = (string) Str::uuid();
        $submitterId = (string) Str::uuid();
        $previousStaffId = (string) Str::uuid();
        $newStaffId = (string) Str::uuid();

        DB::table('departments')->insert([
            'id' => $departmentId,
            'name' => 'External Relations',
        ]);
        DB::table('profiles')->insert([
            ['id' => $submitterId, 'role' => 'department_staff', 'email' => 'department@example.test', 'is_active' => true],
            ['id' => $previousStaffId, 'role' => 'iro_staff', 'email' => 'previous@example.test', 'is_active' => true],
            ['id' => $newStaffId, 'role' => 'iro_staff', 'email' => 'new@example.test', 'is_active' => true],
        ]);
        $document = Document::create([
            'tracking_number' => 'CONEXIA-OWNERSHIP-001',
            'title' => 'Reassigned Submission',
            'document_type' => 'MOF',
            'partner_institution' => 'Partner Office',
            'department_id' => $departmentId,
            'submitted_by' => $submitterId,
            'assigned_iro_staff' => $newStaffId,
            'status' => 'Submitted',
            'submitted_at' => now(),
            'updated_at' => now(),
        ]);

        $controller = app(DocumentController::class);
        $dashboard = $controller->iroStaffDashboard(
            $this->request([], $newStaffId, 'iro_staff')
        );
        $assigned = json_decode($dashboard->getContent(), true)['data']['assignedQueue'];
        $this->assertCount(1, $assigned);
        $this->assertSame($document->id, $assigned[0]['id']);

        $this->expectException(NotFoundHttpException::class);
        $controller->log(
            $this->request([], $previousStaffId, 'iro_staff'),
            $document
        );
    }

    public function test_admin_staff_actions_do_not_assign_admin_as_iro_staff(): void
    {
        $departmentId = (string) Str::uuid();
        $submitterId = (string) Str::uuid();
        $staffId = (string) Str::uuid();
        $adminId = (string) Str::uuid();

        DB::table('departments')->insert([
            'id' => $departmentId,
            'name' => 'International Partnerships',
        ]);
        DB::table('profiles')->insert([
            ['id' => $submitterId, 'role' => 'department_staff', 'email' => 'department@example.test', 'is_active' => true],
            ['id' => $staffId, 'role' => 'iro_staff', 'email' => 'staff@example.test', 'is_active' => true],
            ['id' => $adminId, 'role' => 'iro_admin', 'email' => 'admin@example.test', 'is_active' => true],
        ]);

        $unassigned = Document::create([
            'tracking_number' => 'CONEXIA-ADMIN-LOG-001',
            'title' => 'Admin Logged Agreement',
            'document_type' => 'MOA',
            'partner_institution' => 'Partner A',
            'department_id' => $departmentId,
            'submitted_by' => $submitterId,
            'status' => 'Submitted',
            'submitted_at' => now(),
            'updated_at' => now(),
        ]);
        app(DocumentController::class)->log(
            $this->request([], $adminId, 'iro_admin'),
            $unassigned
        );
        $this->assertNull($unassigned->fresh()->assigned_iro_staff);

        $assigned = Document::create([
            'tracking_number' => 'CONEXIA-ADMIN-REVIEW-001',
            'title' => 'Admin Prepared Review',
            'document_type' => 'MOU',
            'partner_institution' => 'Partner B',
            'department_id' => $departmentId,
            'submitted_by' => $submitterId,
            'assigned_iro_staff' => $staffId,
            'status' => 'Logged',
            'submitted_at' => now(),
            'updated_at' => now(),
        ]);
        app(ReviewFormController::class)->submit(
            $this->request([
                'checklist_answers' => [
                    'signatures' => true,
                    'terms' => true,
                    'attachments' => true,
                    'gdpr' => true,
                ],
                'staff_remarks' => 'Completed by IRO Admin.',
            ], $adminId, 'iro_admin'),
            $assigned
        );
        $this->assertSame($staffId, $assigned->fresh()->assigned_iro_staff);
        $this->assertSame('Review Form Submitted', $assigned->fresh()->status);
    }

    public function test_assigned_legal_counsel_can_store_a_notarized_pdf(): void
    {
        Storage::fake('local');
        $departmentId = (string) Str::uuid();
        $submitterId = (string) Str::uuid();
        $staffId = (string) Str::uuid();
        $adminId = (string) Str::uuid();
        $legalId = (string) Str::uuid();

        DB::table('departments')->insert([
            'id' => $departmentId,
            'name' => 'International Office',
        ]);
        DB::table('profiles')->insert([
            ['id' => $submitterId, 'role' => 'department_staff', 'email' => 'department@example.test', 'is_active' => true],
            ['id' => $staffId, 'role' => 'iro_staff', 'email' => 'staff@example.test', 'is_active' => true],
            ['id' => $adminId, 'role' => 'iro_admin', 'email' => 'admin@example.test', 'is_active' => true],
            ['id' => $legalId, 'role' => 'legal_counsel', 'email' => 'legal@example.test', 'is_active' => true],
        ]);

        $document = Document::create([
            'tracking_number' => 'CONEXIA-NOTARY-001',
            'title' => 'Approved Agreement',
            'document_type' => 'MOA',
            'partner_institution' => 'Partner University',
            'department_id' => $departmentId,
            'submitted_by' => $submitterId,
            'assigned_iro_staff' => $staffId,
            'assigned_legal_counsel' => $legalId,
            'status' => 'Approved',
            'submitted_at' => now(),
            'updated_at' => now(),
        ]);

        $request = Request::create(
            '/',
            'POST',
            [
                'notarial_reference_number' => 'NOT-2026-001',
                'notarization_date' => now()->toDateString(),
                'notary_signature_code' => 'SIG-001',
            ],
            [],
            [
                'file' => UploadedFile::fake()->create(
                    'notarized-agreement.pdf',
                    250,
                    'application/pdf'
                ),
            ]
        );
        $request->attributes->set('auth_profile', (object) [
            'id' => $legalId,
            'role' => 'legal_counsel',
            'department_id' => null,
            'email' => 'legal@example.test',
        ]);

        $response = app(DocumentController::class)
            ->recordNotarization($request, $document);

        $this->assertSame(201, $response->getStatusCode());
        $this->assertSame('Notarized', $document->fresh()->status);
        $this->assertSame(
            'NOT-2026-001',
            $document->fresh()->notarial_reference_number
        );
        $fileRecord = DB::table('document_files')->first();
        $this->assertSame('notarized_copy', $fileRecord->file_category);
        Storage::disk('local')->assertExists($fileRecord->storage_path);
        $this->assertDatabaseHas('workflow_events', [
            'document_id' => $document->id,
            'event_type' => 'document_notarized',
            'from_status' => 'Approved',
            'to_status' => 'Notarized',
        ]);
        $this->assertDatabaseHas('notifications', [
            'document_id' => $document->id,
            'user_id' => $adminId,
            'type' => 'document_notarized',
        ]);
    }

    private function request(array $payload, string $profileId, string $role): Request
    {
        $request = Request::create('/', 'POST', $payload);
        $request->attributes->set('auth_profile', (object) [
            'id' => $profileId,
            'role' => $role,
            'department_id' => null,
            'full_name' => ucfirst(str_replace('_', ' ', $role)),
            'email' => "{$role}@example.test",
        ]);

        return $request;
    }
}
