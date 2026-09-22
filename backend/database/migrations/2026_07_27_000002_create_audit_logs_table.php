<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // DB-NOTE: i-store ang audit trail uban sa actor, document, ug payload metadata fields.
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('actor_id')->nullable()->index();
            $table->uuid('document_id')->nullable()->index();
            $table->uuid('document_file_id')->nullable()->index();
            $table->string('action');
            $table->json('metadata')->nullable();
            $table->timestamp('created_at')->nullable();
        });
    }

    // DB-NOTE: tangtanga ang audit trail table kung i-revert ang migration.
    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
