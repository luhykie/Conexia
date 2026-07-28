<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('submissions', function (Blueprint $table) {
            $table->string('submission_type')->default('new_partnership')->after('title');
            $table->string('partner_classification')->default('local')->after('submission_type');
            $table->uuid('created_by')->nullable()->after('submitted_by');
            $table->string('department_id')->nullable()->after('department');
            $table->integer('version')->default(1)->after('revision_cycle');
        });
    }

    public function down(): void
    {
        Schema::table('submissions', function (Blueprint $table) {
            $table->dropColumn([
                'submission_type',
                'partner_classification',
                'created_by',
                'department_id',
                'version',
            ]);
        });
    }
};
