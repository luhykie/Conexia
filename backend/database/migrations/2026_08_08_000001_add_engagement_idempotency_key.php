<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('engagements', function (Blueprint $table): void {
            $table->uuid('client_submission_id')->nullable()->unique();
        });
    }

    public function down(): void
    {
        Schema::table('engagements', function (Blueprint $table): void {
            $table->dropUnique(['client_submission_id']);
            $table->dropColumn('client_submission_id');
        });
    }
};
