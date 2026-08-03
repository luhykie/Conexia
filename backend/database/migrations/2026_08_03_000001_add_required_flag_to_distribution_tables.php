<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('distribution_recipients', function (Blueprint $table): void {
            $table->boolean('is_required')->default(true)->after('access_level');
        });

        Schema::table('document_distributions', function (Blueprint $table): void {
            $table->boolean('is_required')->default(true)->after('access_level');
        });
    }

    public function down(): void
    {
        Schema::table('document_distributions', function (Blueprint $table): void {
            $table->dropColumn('is_required');
        });

        Schema::table('distribution_recipients', function (Blueprint $table): void {
            $table->dropColumn('is_required');
        });
    }
};
