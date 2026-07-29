<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workflow_events', function (Blueprint $table): void {
            $table->uuid('id')
                ->primary()
                ->default(DB::raw('gen_random_uuid()'));
            $table->uuid('document_id');
            $table->uuid('actor_id');
            $table->string('actor_role', 50);
            $table->string('event_type', 100);
            $table->string('from_status', 100)->nullable();
            $table->string('to_status', 100);
            $table->text('notes')->nullable();
            $table->timestampTz('created_at')->useCurrent();

            $table->foreign('document_id')
                ->references('id')
                ->on('documents')
                ->cascadeOnDelete();
            $table->foreign('actor_id')
                ->references('id')
                ->on('profiles')
                ->restrictOnDelete();

            $table->index(['document_id', 'created_at']);
            $table->index(['actor_id', 'created_at']);
            $table->index(['event_type', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workflow_events');
    }
};
