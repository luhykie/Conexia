<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_distributions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('document_id');
            $table->uuid('distribution_recipient_id');
            $table->string('recipient_name');
            $table->string('recipient_email');
            $table->string('organization')->nullable();
            $table->string('role_scope', 30);
            $table->string('access_level', 30);
            $table->string('delivery_status', 30)->default('Pending');
            $table->text('delivery_notes')->nullable();
            $table->timestampTz('distributed_at')->nullable();
            $table->uuid('distributed_by')->nullable();
            $table->timestampsTz();

            $table->unique(['document_id', 'distribution_recipient_id']);
            $table->foreign('document_id')->references('id')->on('documents')->cascadeOnDelete();
            $table->foreign('distribution_recipient_id')->references('id')->on('distribution_recipients')->restrictOnDelete();
            $table->foreign('distributed_by')->references('id')->on('profiles')->nullOnDelete();
            $table->index(['document_id', 'delivery_status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_distributions');
    }
};
