<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table): void {
            $table->uuid('partner_department_id')->nullable()->index()->after('department_id');
            $table->unsignedInteger('department_review_version')->default(1)->after('partner_department_id');
        });

        Schema::create('document_department_reviews', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('document_id')->index();
            $table->uuid('department_id')->index();
            $table->unsignedInteger('version')->default(1);
            $table->timestamp('approved_at')->nullable();
            $table->uuid('approved_by')->nullable()->index();
            $table->timestamps();
            $table->unique(['document_id', 'department_id', 'version'], 'document_department_review_version_unique');
        });

        Schema::create('document_review_items', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('document_id')->index();
            $table->uuid('document_file_id')->nullable()->index();
            $table->uuid('department_id')->index();
            $table->uuid('author_id')->index();
            $table->uuid('parent_id')->nullable()->index();
            $table->string('type', 20);
            $table->string('highlight_color', 32)->nullable();
            $table->text('selected_text')->nullable();
            $table->json('selection_anchor')->nullable();
            $table->text('comment')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_review_items');
        Schema::dropIfExists('document_department_reviews');
        Schema::table('documents', function (Blueprint $table): void {
            $table->dropColumn(['partner_department_id', 'department_review_version']);
        });
    }
};
