<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('notifications')
            ->where('type', 'legal_approved')
            ->update([
                'message' => DB::raw("(SELECT tracking_number FROM documents WHERE documents.id = notifications.document_id) || ' was approved by Legal Counsel and is ready for IRO Staff distribution assignment.'"),
            ]);
    }

    public function down(): void
    {
        // Notification wording is not workflow state and does not require rollback.
    }
};
