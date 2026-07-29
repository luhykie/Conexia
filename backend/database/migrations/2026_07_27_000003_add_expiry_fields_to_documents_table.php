<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table): void {
            if (!Schema::hasColumn('documents', 'effective_date')) {
                $table->date('effective_date')->nullable();
            }

            if (!Schema::hasColumn('documents', 'expiry_date')) {
                $table->date('expiry_date')->nullable();
            }

            if (!Schema::hasColumn('documents', 'renewal_notice_days')) {
                $table->unsignedInteger('renewal_notice_days')->nullable();
            }

            if (!Schema::hasColumn('documents', 'renewal_status')) {
                $table->string('renewal_status')
                    ->default('not_required');
            }
        });
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table): void {
            $table->dropColumn([
                'effective_date',
                'expiry_date',
                'renewal_notice_days',
                'renewal_status',
            ]);
        });
    }
};
