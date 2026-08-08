<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TYPE document_status ADD VALUE IF NOT EXISTS 'Assigned for Distribution'");
        }
        Schema::table('documents', function (Blueprint $table): void {
            $table->text('admin_distribution_instructions')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table): void {
            $table->dropColumn('admin_distribution_instructions');
        });
    }
};
