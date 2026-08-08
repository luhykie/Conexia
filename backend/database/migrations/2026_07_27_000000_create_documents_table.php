<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('documents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('tracking_number')->nullable()->unique();
            $table->string('title')->nullable();
            $table->string('document_type')->nullable();
            $table->string('partner_institution')->nullable();
            $table->string('partner_email')->nullable();
            $table->text('description')->nullable();
            $table->uuid('department_id')->nullable()->index();
            $table->uuid('submitted_by')->nullable()->index();
            $table->uuid('assigned_legal_counsel')->nullable()->index();
            $table->string('status')->index();
            $table->text('legal_notes')->nullable();
            $table->string('notarial_reference_number')->nullable();
            $table->date('notarization_date')->nullable();
            $table->string('notary_signature_code')->nullable();
            $table->timestamp('archived_at')->nullable();
            $table->uuid('archived_by')->nullable();
            $table->date('effective_date')->nullable();
            $table->date('expiry_date')->nullable();
            $table->unsignedInteger('renewal_notice_days')->nullable();
            $table->string('renewal_status')->default('not_required');
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('documents');
    }
};
