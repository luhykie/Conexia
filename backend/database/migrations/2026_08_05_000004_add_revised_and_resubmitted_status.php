<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TYPE document_status ADD VALUE IF NOT EXISTS 'Revised and Resubmitted'");
    }

    public function down(): void
    {
        // PostgreSQL enum values are retained to protect existing workflow data.
    }
};
