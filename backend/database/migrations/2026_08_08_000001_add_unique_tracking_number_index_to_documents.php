<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement(
            'create unique index if not exists documents_tracking_number_unique_idx on documents (tracking_number)'
        );
    }

    public function down(): void
    {
        DB::statement('drop index if exists documents_tracking_number_unique_idx');
    }
};
