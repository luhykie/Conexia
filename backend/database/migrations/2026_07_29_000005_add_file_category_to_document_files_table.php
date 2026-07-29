<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_files', function (Blueprint $table): void {
            $table->string('file_category', 50)
                ->default('original_draft')
                ->after('uploaded_by');
            $table->index(
                ['document_id', 'file_category'],
                'document_files_document_category_index'
            );
        });

        DB::table('document_files')
            ->where('version', '>', 1)
            ->update(['file_category' => 'reviewed_version']);
    }

    public function down(): void
    {
        Schema::table('document_files', function (Blueprint $table): void {
            $table->dropIndex('document_files_document_category_index');
            $table->dropColumn('file_category');
        });
    }
};
