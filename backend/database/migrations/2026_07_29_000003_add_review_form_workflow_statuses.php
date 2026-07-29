<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public $withinTransaction = false;

    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement("ALTER TYPE document_status ADD VALUE IF NOT EXISTS 'Review Form Submitted'");
        DB::statement("ALTER TYPE document_status ADD VALUE IF NOT EXISTS 'Review Form Sent Back'");
        DB::statement("ALTER TYPE document_status ADD VALUE IF NOT EXISTS 'Admin Validated'");
    }

    public function down(): void
    {
        // PostgreSQL enum values cannot be removed safely while rows may use them.
    }
};
