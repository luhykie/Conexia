<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_review_items', function (Blueprint $table): void {
            $table->timestamp('confirmed_at')->nullable()->after('highlight_removed_at')->index();
        });

        // Preserve visibility of annotations saved before draft reviews existed.
        DB::table('document_review_items')->whereNull('confirmed_at')->update(['confirmed_at' => now()]);
    }

    public function down(): void
    {
        Schema::table('document_review_items', function (Blueprint $table): void {
            $table->dropIndex(['confirmed_at']);
            $table->dropColumn('confirmed_at');
        });
    }
};
