<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('CREATE INDEX IF NOT EXISTS documents_status_updated_idx ON documents (status, updated_at DESC)');
        DB::statement('CREATE INDEX IF NOT EXISTS documents_staff_status_updated_idx ON documents (assigned_iro_staff, status, updated_at DESC)');
        DB::statement('CREATE INDEX IF NOT EXISTS documents_department_submitted_idx ON documents (department_id, submitted_at DESC)');
        DB::statement('CREATE INDEX IF NOT EXISTS documents_expiry_idx ON documents (expiry_date) WHERE expiry_date IS NOT NULL');
        DB::statement('CREATE INDEX IF NOT EXISTS documents_archived_idx ON documents (archived_at DESC) WHERE archived_at IS NOT NULL');
        DB::statement('CREATE INDEX IF NOT EXISTS workflow_events_document_type_created_idx ON workflow_events (document_id, event_type, created_at DESC)');
        DB::statement('CREATE INDEX IF NOT EXISTS review_forms_status_document_idx ON review_forms (review_form_status, document_id)');
        DB::statement('CREATE INDEX IF NOT EXISTS document_files_document_category_version_idx ON document_files (document_id, file_category, version DESC)');
        DB::statement('CREATE INDEX IF NOT EXISTS document_distributions_document_required_status_idx ON document_distributions (document_id, is_required, delivery_status)');
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        foreach ([
            'documents_status_updated_idx',
            'documents_staff_status_updated_idx',
            'documents_department_submitted_idx',
            'documents_expiry_idx',
            'documents_archived_idx',
            'workflow_events_document_type_created_idx',
            'review_forms_status_document_idx',
            'document_files_document_category_version_idx',
            'document_distributions_document_required_status_idx',
        ] as $index) {
            DB::statement("DROP INDEX IF EXISTS {$index}");
        }
    }
};
