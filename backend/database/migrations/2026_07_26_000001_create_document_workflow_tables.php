<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('submissions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('submitted_by');
            $table->string('tracking_number')->unique();
            $table->string('title');
            $table->string('office');
            $table->string('department')->nullable();
            $table->string('contact_person');
            $table->string('contact_position');
            $table->string('contact_email');
            $table->string('contact_number');
            $table->string('partner_institution_name');
            $table->string('agreement_type');
            $table->string('agreement_title');
            $table->string('expected_duration');
            $table->string('partner_contact_email');
            $table->date('requested_completion_date')->nullable();
            $table->string('urgency_level')->default('normal');
            $table->string('requested_by_name');
            $table->date('requested_by_date')->nullable();
            $table->string('noted_by_name')->nullable();
            $table->date('noted_by_date')->nullable();
            $table->string('storage_path')->nullable();
            $table->string('file_name')->nullable();
            $table->string('status')->index();
            $table->string('current_stage')->default('iro_staff');
            $table->string('current_reviewer')->nullable();
            $table->string('current_reviewer_role')->nullable();
            $table->integer('revision_cycle')->default(1);
            $table->timestampTz('submitted_at')->nullable();
            $table->timestampTz('last_reviewed_at')->nullable();
            $table->timestampTz('date_received')->nullable();
            $table->uuid('received_by')->nullable();
            $table->text('pair_remarks')->nullable();
            $table->timestampTz('date_completed')->nullable();
            $table->string('pair_review_status')->nullable();
            $table->date('signing_date')->nullable();
            $table->string('signing_mode')->nullable();
            $table->integer('copies_for_notarization')->nullable();
            $table->string('notarial_reference')->nullable();
            $table->date('notarial_date')->nullable();
            $table->text('legal_comments')->nullable();
            $table->uuid('legal_reviewed_by')->nullable();
            $table->timestampTz('legal_reviewed_at')->nullable();
            $table->timestampTz('review_form_generated_at')->nullable();
            $table->timestampTz('notarization_form_generated_at')->nullable();
            $table->timestamps();
        });

        Schema::create('document_attachments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('submission_id');
            $table->string('storage_path');
            $table->string('file_name');
            $table->uuid('uploaded_by');
            $table->string('upload_reason')->default('original_draft');
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('document_reviews', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('submission_id');
            $table->uuid('reviewer_id');
            $table->string('role_key');
            $table->string('decision');
            $table->text('comments')->nullable();
            $table->string('status_before')->nullable();
            $table->string('status_after');
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        Schema::create('document_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('submission_id');
            $table->uuid('user_id');
            $table->string('role_key');
            $table->string('action');
            $table->text('comments')->nullable();
            $table->timestampTz('created_at')->useCurrent();
        });

        Schema::create('document_comments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('submission_id');
            $table->uuid('user_id');
            $table->string('role_key');
            $table->string('comment_type');
            $table->text('comment_body');
            $table->timestamps();
        });

        Schema::create('document_status_history', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('submission_id');
            $table->string('status_before')->nullable();
            $table->string('status_after');
            $table->uuid('changed_by');
            $table->text('comments')->nullable();
            $table->timestamps();
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->uuid('submission_id')->nullable();
            $table->string('title');
            $table->text('body');
            $table->boolean('is_read')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('document_status_history');
        Schema::dropIfExists('document_comments');
        Schema::dropIfExists('document_logs');
        Schema::dropIfExists('document_reviews');
        Schema::dropIfExists('document_attachments');
        Schema::dropIfExists('submissions');
    }
};
