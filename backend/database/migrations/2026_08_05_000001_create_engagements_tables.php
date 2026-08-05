<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('engagements', function (Blueprint $table): void {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('document_id')->unique();
            $table->string('engagement_type', 50);
            $table->string('partner_classification', 30);
            $table->string('partner_name');
            $table->string('partner_email')->nullable();
            $table->string('partner_contact')->nullable();
            $table->text('partner_address')->nullable();
            $table->string('agreement_title');
            $table->text('agreement_summary')->nullable();
            $table->date('effective_date')->nullable();
            $table->date('expiry_date')->nullable();
            $table->string('lifecycle_status', 30)->default('Active');
            $table->uuid('created_by');
            $table->timestampsTz();

            $table->foreign('document_id')->references('id')->on('documents')->cascadeOnDelete();
            $table->foreign('created_by')->references('id')->on('profiles')->restrictOnDelete();
            $table->index(['partner_classification', 'lifecycle_status']);
            $table->index('expiry_date');
        });

        Schema::create('engagement_department', function (Blueprint $table): void {
            $table->uuid('engagement_id');
            $table->uuid('department_id');
            $table->primary(['engagement_id', 'department_id']);
            $table->foreign('engagement_id')->references('id')->on('engagements')->cascadeOnDelete();
            $table->foreign('department_id')->references('id')->on('departments')->restrictOnDelete();
        });

        Schema::create('engagement_distribution_recipient', function (Blueprint $table): void {
            $table->uuid('engagement_id');
            $table->uuid('distribution_recipient_id');
            $table->primary(['engagement_id', 'distribution_recipient_id']);
            $table->foreign('engagement_id')->references('id')->on('engagements')->cascadeOnDelete();
            $table->foreign('distribution_recipient_id')->references('id')->on('distribution_recipients')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engagement_distribution_recipient');
        Schema::dropIfExists('engagement_department');
        Schema::dropIfExists('engagements');
    }
};
