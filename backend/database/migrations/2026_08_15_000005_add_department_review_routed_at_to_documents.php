<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table): void {
            $table->timestamp('department_review_routed_at')
                ->nullable()
                ->after('department_review_version')
                ->index();
        });

        // Existing records already in the active departmental-review state
        // have been routed under the previous workflow and remain accessible.
        DB::table('documents')
            ->whereNotNull('partner_department_id')
            ->where('status', 'Department Review')
            ->whereNull('department_review_routed_at')
            ->update(['department_review_routed_at' => now()]);
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table): void {
            $table->dropIndex(['department_review_routed_at']);
            $table->dropColumn('department_review_routed_at');
        });
    }
};
