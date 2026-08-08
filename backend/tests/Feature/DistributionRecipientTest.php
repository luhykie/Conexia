<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\DistributionRecipientController;
use App\Http\Controllers\Api\DocumentDistributionController;
use App\Models\DistributionRecipient;
use App\Models\Document;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class DistributionRecipientTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('profiles', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('role');
            $table->string('email');
            $table->boolean('is_active')->default(true);
        });
        Schema::create('distribution_recipients', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('document_type');
            $table->string('recipient_name');
            $table->string('recipient_email');
            $table->string('organization')->nullable();
            $table->string('role_scope');
            $table->string('access_level');
            $table->boolean('is_required')->default(true);
            $table->boolean('is_active')->default(true);
            $table->uuid('created_by');
            $table->uuid('updated_by');
            $table->timestamps();
            $table->unique(['document_type', 'recipient_email']);
        });
        Schema::create('documents', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('tracking_number')->unique();
            $table->string('title');
            $table->string('document_type');
            $table->string('partner_institution');
            $table->string('status');
            $table->timestamp('submitted_at');
            $table->timestamp('updated_at');
        });
        Schema::create('document_distributions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('document_id');
            $table->uuid('distribution_recipient_id');
            $table->string('recipient_name');
            $table->string('recipient_email');
            $table->string('organization')->nullable();
            $table->string('role_scope');
            $table->string('access_level');
            $table->boolean('is_required')->default(true);
            $table->string('delivery_status')->default('Pending');
            $table->text('delivery_notes')->nullable();
            $table->timestamp('distributed_at')->nullable();
            $table->uuid('distributed_by')->nullable();
            $table->timestamps();
            $table->unique(['document_id', 'distribution_recipient_id']);
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
            $table->string('dedupe_key')->unique();
            $table->boolean('is_read')->default(false);
            $table->timestamp('created_at');
            $table->timestamp('read_at')->nullable();
        });
    }

    public function test_admin_can_create_filter_and_update_distribution_recipients(): void
    {
        $adminId = (string) Str::uuid();
        DB::table('profiles')->insert([
            'id' => $adminId,
            'role' => 'iro_admin',
            'email' => 'admin@example.test',
            'is_active' => true,
        ]);
        $controller = new DistributionRecipientController();

        $created = $controller->store($this->request([
            'document_type' => 'MOA',
            'recipient_name' => 'Office of the President',
            'recipient_email' => 'President@Example.test',
            'organization' => 'Example University',
            'role_scope' => 'Signatory',
            'access_level' => 'Full Access',
            'is_required' => false,
        ], $adminId));

        $this->assertSame(201, $created->getStatusCode());
        $recipient = DistributionRecipient::query()->firstOrFail();
        $this->assertSame('president@example.test', $recipient->recipient_email);
        $this->assertTrue($recipient->is_active);
        $this->assertSame('Signatory', $recipient->role_scope);
        $this->assertSame('Full Access', $recipient->access_level);
        $this->assertFalse($recipient->is_required);
        $this->assertSame($adminId, $recipient->created_by);

        $filtered = $controller->index(Request::create(
            '/api/iro-admin/distribution-recipients',
            'GET',
            ['document_type' => 'MOA']
        ));
        $this->assertCount(1, json_decode($filtered->getContent(), true)['data']);

        $updated = $controller->update($this->request([
            'document_type' => 'MOU',
            'recipient_name' => 'Office of the Chancellor',
            'recipient_email' => 'chancellor@example.test',
            'organization' => 'Example University',
            'role_scope' => 'Reviewer',
            'access_level' => 'View Only',
            'is_required' => true,
            'is_active' => false,
        ], $adminId), $recipient);

        $this->assertSame(200, $updated->getStatusCode());
        $this->assertSame('MOU', $recipient->fresh()->document_type);
        $this->assertFalse($recipient->fresh()->is_active);
        $this->assertSame($adminId, $recipient->fresh()->updated_by);
    }

    public function test_same_email_cannot_be_duplicated_for_one_document_type(): void
    {
        $adminId = (string) Str::uuid();
        DB::table('profiles')->insert([
            'id' => $adminId,
            'role' => 'iro_admin',
            'email' => 'admin@example.test',
            'is_active' => true,
        ]);
        $controller = new DistributionRecipientController();
        $values = [
            'document_type' => 'MOF',
            'recipient_name' => 'Records Office',
            'recipient_email' => 'records@example.test',
            'role_scope' => 'CC',
            'access_level' => 'View Only',
        ];

        $controller->store($this->request($values, $adminId));

        $this->expectException(ValidationException::class);
        $controller->store($this->request($values, $adminId));
    }

    public function test_distribution_requires_delivery_to_every_recipient_before_completion(): void
    {
        $adminId = (string) Str::uuid();
        DB::table('profiles')->insert([
            'id' => $adminId,
            'role' => 'iro_admin',
            'email' => 'admin@example.test',
            'is_active' => true,
        ]);
        $recipient = DistributionRecipient::create([
            'document_type' => 'MOA',
            'recipient_name' => 'Records Office',
            'recipient_email' => 'records@example.test',
            'organization' => 'Example University',
            'role_scope' => 'CC',
            'access_level' => 'View Only',
            'is_required' => true,
            'is_active' => true,
            'created_by' => $adminId,
            'updated_by' => $adminId,
        ]);
        $optionalRecipient = DistributionRecipient::create([
            'document_type' => 'MOA',
            'recipient_name' => 'Courtesy Copy Office',
            'recipient_email' => 'courtesy@example.test',
            'organization' => 'Example University',
            'role_scope' => 'CC',
            'access_level' => 'View Only',
            'is_required' => false,
            'is_active' => true,
            'created_by' => $adminId,
            'updated_by' => $adminId,
        ]);
        $document = Document::create([
            'tracking_number' => 'CONEXIA-DIST-001',
            'title' => 'Distribution Test',
            'document_type' => 'MOA',
            'partner_institution' => 'Example University',
            'status' => 'Notarized',
            'submitted_at' => now(),
            'updated_at' => now(),
        ]);
        $controller = new DocumentDistributionController();

        $prepared = $controller->prepare($this->request([], $adminId), $document);
        $this->assertSame(200, $prepared->getStatusCode());
        $this->assertSame('Ready for Distribution', $document->fresh()->status);
        $distribution = $document->distributions()
            ->where('distribution_recipient_id', $recipient->id)
            ->firstOrFail();
        $this->assertSame($recipient->id, $distribution->distribution_recipient_id);
        $this->assertTrue($distribution->is_required);
        $this->assertSame('Pending', $distribution->delivery_status);
        $this->assertDatabaseHas('document_distributions', [
            'distribution_recipient_id' => $optionalRecipient->id,
            'is_required' => false,
            'delivery_status' => 'Pending',
        ]);

        $prematureCompletion = $controller->complete(
            $this->request([], $adminId),
            $document->fresh()
        );
        $this->assertSame(422, $prematureCompletion->getStatusCode());

        $delivered = $controller->markDelivered(
            $this->request(['delivery_notes' => 'Sent by official email.'], $adminId),
            $document->fresh(),
            $distribution
        );
        $this->assertSame(200, $delivered->getStatusCode());
        $this->assertSame('Delivered', $distribution->fresh()->delivery_status);
        $this->assertSame($adminId, $distribution->fresh()->distributed_by);

        $completed = $controller->complete(
            $this->request([], $adminId),
            $document->fresh()
        );
        $this->assertSame(200, $completed->getStatusCode());
        $this->assertSame('Distribution Complete', $document->fresh()->status);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $adminId,
            'document_id' => $document->id,
            'type' => 'distribution_completed',
            'is_read' => false,
        ]);
        $this->assertDatabaseHas('document_distributions', [
            'distribution_recipient_id' => $optionalRecipient->id,
            'delivery_status' => 'Pending',
        ]);
        $this->assertDatabaseHas('workflow_events', [
            'document_id' => $document->id,
            'event_type' => 'distribution_completed',
            'to_status' => 'Distribution Complete',
        ]);
    }

    private function request(array $payload, string $profileId): Request
    {
        $request = Request::create('/api/test', 'POST', $payload);
        $request->attributes->set('auth_profile', (object) [
            'id' => $profileId,
            'role' => 'iro_admin',
        ]);

        return $request;
    }
}
