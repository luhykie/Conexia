<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('distribution_recipients', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('document_type', 10);
            $table->string('recipient_name');
            $table->string('recipient_email');
            $table->string('organization')->nullable();
            $table->boolean('is_active')->default(true);
            $table->uuid('created_by');
            $table->uuid('updated_by');
            $table->timestampsTz();

            $table->unique(['document_type', 'recipient_email']);
            $table->index(['document_type', 'is_active']);
            $table->foreign('created_by')->references('id')->on('profiles')->restrictOnDelete();
            $table->foreign('updated_by')->references('id')->on('profiles')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('distribution_recipients');
    }
};
