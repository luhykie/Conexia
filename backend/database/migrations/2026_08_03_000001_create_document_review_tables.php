<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_comments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('submission_id');
            $table->uuid('document_version_id')->nullable()->index();
            $table->uuid('user_id');
            $table->string('role_key');
            $table->integer('page_number')->default(1);
            $table->text('selected_text')->nullable();
            $table->json('highlight_coordinates')->nullable();
            $table->string('highlight_color')->nullable();
            $table->string('comment_type')->default('inline');
            $table->text('comment');
            $table->boolean('resolved')->default(false);
            $table->string('created_by_name')->nullable();
            $table->string('role')->nullable();
            $table->timestamps();
        });

        Schema::create('document_annotations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('submission_id');
            $table->uuid('document_version_id')->nullable()->index();
            $table->integer('page_number')->default(1);
            $table->json('highlight_coordinates')->nullable();
            $table->string('color')->default('#f5c542');
            $table->uuid('created_by');
            $table->string('created_by_name')->nullable();
            $table->string('role')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_annotations');
        Schema::dropIfExists('document_comments');
    }
};
