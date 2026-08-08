<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('create index if not exists documents_status_idx on documents (status)');
        DB::statement('create index if not exists documents_department_id_idx on documents (department_id)');
        DB::statement('create index if not exists documents_assigned_legal_counsel_idx on documents (assigned_legal_counsel)');
        DB::statement('create index if not exists documents_updated_at_idx on documents (updated_at)');
        DB::statement('create index if not exists documents_expiry_date_idx on documents (expiry_date)');
        DB::statement('create index if not exists notifications_user_id_idx on notifications (user_id)');
        DB::statement('create index if not exists notifications_read_at_idx on notifications (read_at)');
        DB::statement('create index if not exists audit_logs_document_id_idx on audit_logs (document_id)');
        DB::statement('create index if not exists audit_logs_created_at_idx on audit_logs (created_at)');
    }

    public function down(): void
    {
        DB::statement('drop index if exists audit_logs_created_at_idx');
        DB::statement('drop index if exists audit_logs_document_id_idx');
        DB::statement('drop index if exists notifications_read_at_idx');
        DB::statement('drop index if exists notifications_user_id_idx');
        DB::statement('drop index if exists documents_expiry_date_idx');
        DB::statement('drop index if exists documents_updated_at_idx');
        DB::statement('drop index if exists documents_assigned_legal_counsel_idx');
        DB::statement('drop index if exists documents_department_id_idx');
        DB::statement('drop index if exists documents_status_idx');
    }
};
