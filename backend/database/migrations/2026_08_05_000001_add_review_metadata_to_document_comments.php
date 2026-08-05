<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_comments', function (Blueprint $table) {
            if (! Schema::hasColumn('document_comments', 'highlight_color')) {
                $table->string('highlight_color')->nullable()->after('highlight_coordinates');
            }

            if (! Schema::hasColumn('document_comments', 'comment_type')) {
                $table->string('comment_type')->default('inline')->after('highlight_color');
            }
        });
    }

    public function down(): void
    {
        Schema::table('document_comments', function (Blueprint $table) {
            if (Schema::hasColumn('document_comments', 'comment_type')) {
                $table->dropColumn('comment_type');
            }

            if (Schema::hasColumn('document_comments', 'highlight_color')) {
                $table->dropColumn('highlight_color');
            }
        });
    }
};
