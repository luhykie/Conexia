<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Adds the fields required by the Super Admin department Manage form.
    public function up(): void
    {
        Schema::table('departments', function (Blueprint $table): void {
            if (!Schema::hasColumn('departments', 'office_assignment')) {
                $table->string('office_assignment')->nullable();
            }

            if (!Schema::hasColumn('departments', 'is_active')) {
                $table->boolean('is_active')->default(true);
            }
        });
    }

    public function down(): void
    {
        Schema::table('departments', function (Blueprint $table): void {
            if (Schema::hasColumn('departments', 'office_assignment')) {
                $table->dropColumn('office_assignment');
            }

            if (Schema::hasColumn('departments', 'is_active')) {
                $table->dropColumn('is_active');
            }
        });
    }
};
