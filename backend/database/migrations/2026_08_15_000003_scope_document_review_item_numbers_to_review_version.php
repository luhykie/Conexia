<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_review_items', function (Blueprint $table): void {
            $table->unsignedInteger('review_version')->default(1)->after('document_id');
            $table->dropUnique('document_review_items_display_number_unique');
            $table->unique(['document_id', 'review_version', 'display_number'], 'document_review_items_version_display_number_unique');
        });
    }

    public function down(): void
    {
        Schema::table('document_review_items', function (Blueprint $table): void {
            $table->dropUnique('document_review_items_version_display_number_unique');
            $table->dropColumn('review_version');
            $table->unique(['document_id', 'display_number'], 'document_review_items_display_number_unique');
        });
    }
};
