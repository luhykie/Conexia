<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\DistributionRecipientController;
use App\Models\DistributionRecipient;
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
            $table->boolean('is_active')->default(true);
            $table->uuid('created_by');
            $table->uuid('updated_by');
            $table->timestamps();
            $table->unique(['document_type', 'recipient_email']);
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
        ], $adminId));

        $this->assertSame(201, $created->getStatusCode());
        $recipient = DistributionRecipient::query()->firstOrFail();
        $this->assertSame('president@example.test', $recipient->recipient_email);
        $this->assertTrue($recipient->is_active);
        $this->assertSame('Signatory', $recipient->role_scope);
        $this->assertSame('Full Access', $recipient->access_level);
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
