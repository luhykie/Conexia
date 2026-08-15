<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_review_items', function ($table): void {
            $table->dropUnique('document_review_items_version_display_number_unique');
        });

        // Earlier removals cleared only the color. Mark those annotations as
        // removed before restricting display-number uniqueness to active ones.
        DB::table('document_review_items')
            ->where('type', 'highlight')
            ->whereNull('highlight_color')
            ->whereNull('highlight_removed_at')
            ->update(['highlight_removed_at' => now(), 'display_number' => null]);

        DB::statement(
            'CREATE UNIQUE INDEX document_review_items_active_number_unique '
            .'ON document_review_items (document_id, review_version, display_number) '
            .'WHERE highlight_removed_at IS NULL AND display_number IS NOT NULL'
        );
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS document_review_items_active_number_unique');
        Schema::table('document_review_items', function ($table): void {
            $table->unique(['document_id', 'review_version', 'display_number'], 'document_review_items_version_display_number_unique');
        });
    }
};
