<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Preserve profile IDs and all related submission data, while making
        // former IRO Staff accounts unable to authenticate.
        DB::table('profiles')
            ->where('role', 'iro_staff')
            ->update([
                'role' => 'iro_admin',
                'is_active' => false,
            ]);

        DB::table('role_permissions')
            ->where('role', 'iro_staff')
            ->delete();
    }

    public function down(): void
    {
        // Individual former roles cannot be reconstructed safely.
    }
};
