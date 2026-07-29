<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('review_forms', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('document_id')->unique();
            $table->jsonb('checklist_answers');
            $table->text('staff_remarks')->nullable();
            $table->string('review_form_status')->default('draft');
            $table->uuid('prepared_by');
            $table->timestampTz('submitted_at')->nullable();
            $table->text('admin_remarks')->nullable();
            $table->uuid('validated_by')->nullable();
            $table->timestampTz('validated_at')->nullable();
            $table->text('sent_back_reason')->nullable();
            $table->uuid('sent_back_by')->nullable();
            $table->timestampTz('sent_back_at')->nullable();
            $table->timestampsTz();

            $table->foreign('document_id')->references('id')->on('documents')->cascadeOnDelete();
            $table->foreign('prepared_by')->references('id')->on('profiles')->restrictOnDelete();
            $table->foreign('validated_by')->references('id')->on('profiles')->nullOnDelete();
            $table->foreign('sent_back_by')->references('id')->on('profiles')->nullOnDelete();
            $table->index(['review_form_status', 'submitted_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('review_forms');
    }
};
