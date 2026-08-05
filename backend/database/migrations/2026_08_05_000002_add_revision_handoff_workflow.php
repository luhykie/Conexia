<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TYPE document_status ADD VALUE IF NOT EXISTS 'Assigned for Revision Handling'");
        DB::statement("ALTER TYPE document_status ADD VALUE IF NOT EXISTS 'Sent to Department for Revision'");

        Schema::table('documents', function (Blueprint $table): void {
            $table->text('admin_revision_instructions')->nullable();
            $table->text('staff_forwarding_note')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table): void {
            $table->dropColumn(['admin_revision_instructions', 'staff_forwarding_note']);
        });
    }
};
