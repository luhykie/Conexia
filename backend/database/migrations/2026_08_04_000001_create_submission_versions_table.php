<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('submission_versions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('submission_id')->index();
            $table->integer('version_number')->default(1)->index();
            $table->string('storage_path');
            $table->string('file_name');
            $table->uuid('uploaded_by')->nullable();
            $table->string('upload_reason')->default('original_draft');
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('submission_versions');
    }
};
