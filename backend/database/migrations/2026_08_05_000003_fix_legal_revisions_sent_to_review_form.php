<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement(<<<'SQL'
            UPDATE documents
            SET status = 'Assigned for Revision Handling', updated_at = NOW()
            WHERE status = 'Review Form Sent Back'
              AND legal_notes IS NOT NULL
              AND BTRIM(legal_notes) <> ''
              AND EXISTS (
                  SELECT 1
                  FROM review_forms
                  WHERE review_forms.document_id = documents.id
                    AND review_forms.review_form_status = 'validated'
              )
        SQL);
    }

    public function down(): void
    {
        // This migration repairs workflow data and is intentionally irreversible.
    }
};
