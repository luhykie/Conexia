<?php

use App\Models\DocumentReviewItem;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_review_items', function (Blueprint $table): void {
            $table->unsignedInteger('display_number')->nullable()->after('type');
            $table->timestamp('highlight_removed_at')->nullable()->after('highlight_color');
            $table->unique(['document_id', 'display_number'], 'document_review_items_display_number_unique');
        });

        DocumentReviewItem::query()
            ->where('type', 'highlight')
            ->whereNull('display_number')
            ->orderBy('document_id')
            ->orderBy('created_at')
            ->orderBy('id')
            ->get()
            ->groupBy('document_id')
            ->each(function ($items): void {
                foreach ($items->values() as $index => $item) {
                    $item->update(['display_number' => $index + 1]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('document_review_items', function (Blueprint $table): void {
            $table->dropUnique('document_review_items_display_number_unique');
            $table->dropColumn(['display_number', 'highlight_removed_at']);
        });
    }
};
