<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('CREATE EXTENSION IF NOT EXISTS pgcrypto');
        DB::statement(<<<'SQL'
            DO $$ BEGIN
                CREATE TYPE document_status AS ENUM (
                    'Submitted', 'Logged', 'Under Legal Review',
                    'Corrections Needed', 'Approved', 'Pending Notarization',
                    'Notarized', 'Ready for Distribution',
                    'Distribution Complete', 'Archived'
                );
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$
        SQL);

        Schema::create('departments', function (Blueprint $table): void {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->string('name');
            $table->string('code')->unique();
            $table->string('email')->nullable()->unique();
        });

        Schema::create('profiles', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('full_name');
            $table->string('email')->unique();
            $table->string('role', 50);
            $table->uuid('department_id')->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreign('department_id')->references('id')->on('departments')->nullOnDelete();
            $table->index(['role', 'is_active']);
        });

        Schema::create('documents', function (Blueprint $table): void {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->string('tracking_number')->unique();
            $table->string('title');
            $table->string('document_type', 20);
            $table->string('partner_institution');
            $table->string('partner_email')->nullable();
            $table->text('description')->nullable();
            $table->uuid('department_id')->nullable();
            $table->uuid('submitted_by')->nullable();
            $table->uuid('assigned_iro_staff')->nullable();
            $table->uuid('assigned_legal_counsel')->nullable();
            $table->string('status', 100)->default('Submitted');
            $table->text('legal_notes')->nullable();
            $table->string('notarial_reference_number')->nullable();
            $table->date('notarization_date')->nullable();
            $table->string('notary_signature_code')->nullable();
            $table->timestampTz('archived_at')->nullable();
            $table->uuid('archived_by')->nullable();
            $table->text('signed_document_summary')->nullable();
            $table->timestampTz('summary_extracted_at')->nullable();
            $table->date('effective_date')->nullable();
            $table->date('expiry_date')->nullable();
            $table->unsignedInteger('renewal_notice_days')->nullable();
            $table->string('renewal_status')->default('not_required');
            $table->timestampTz('submitted_at')->nullable();
            $table->timestampTz('updated_at')->nullable();

            $table->foreign('department_id')->references('id')->on('departments')->nullOnDelete();
            $table->foreign('submitted_by')->references('id')->on('profiles')->nullOnDelete();
            $table->foreign('assigned_iro_staff')->references('id')->on('profiles')->nullOnDelete();
            $table->foreign('assigned_legal_counsel')->references('id')->on('profiles')->nullOnDelete();
            $table->foreign('archived_by')->references('id')->on('profiles')->nullOnDelete();
            $table->index('status');
            $table->index('updated_at');
            $table->index('expiry_date');
        });

        Schema::create('document_files', function (Blueprint $table): void {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('document_id');
            $table->uuid('uploaded_by')->nullable();
            $table->string('original_filename');
            $table->string('stored_filename');
            $table->string('storage_disk')->default('local');
            $table->string('storage_path');
            $table->string('mime_type');
            $table->unsignedBigInteger('size');
            $table->unsignedInteger('version')->default(1);
            $table->timestampTz('deleted_at')->nullable();
            $table->timestampsTz();
            $table->foreign('document_id')->references('id')->on('documents')->cascadeOnDelete();
            $table->foreign('uploaded_by')->references('id')->on('profiles')->nullOnDelete();
            $table->index(['document_id', 'version']);
        });

        Schema::create('audit_logs', function (Blueprint $table): void {
            $table->uuid('id')->primary()->default(DB::raw('gen_random_uuid()'));
            $table->uuid('actor_id')->nullable();
            $table->uuid('document_id')->nullable();
            $table->uuid('document_file_id')->nullable();
            $table->string('action');
            $table->jsonb('metadata')->nullable();
            $table->timestampTz('created_at')->useCurrent();
            $table->foreign('actor_id')->references('id')->on('profiles')->nullOnDelete();
            $table->foreign('document_id')->references('id')->on('documents')->cascadeOnDelete();
            $table->foreign('document_file_id')->references('id')->on('document_files')->nullOnDelete();
            $table->index(['document_id', 'created_at']);
        });

        DB::table('departments')->insert([
            ['code' => 'SBM', 'name' => 'School of Business and Management', 'email' => 'sbm@conexia.edu'],
            ['code' => 'SEA', 'name' => 'School of Engineering and Architecture', 'email' => 'sea@conexia.edu'],
            ['code' => 'SAS', 'name' => 'School of Arts and Sciences', 'email' => 'sas@conexia.edu'],
            ['code' => 'SAMS', 'name' => 'School of Allied Medical Sciences', 'email' => 'sams@conexia.edu'],
            ['code' => 'SCS', 'name' => 'School of Computer Studies', 'email' => 'scs@conexia.edu'],
            ['code' => 'SED', 'name' => 'School of Education', 'email' => 'sed@conexia.edu'],
            ['code' => 'SOL', 'name' => 'School of Law', 'email' => 'sol@conexia.edu'],
            ['code' => 'ETEEAP', 'name' => 'Expanded Tertiary Education Equivalency and Accreditation Program', 'email' => 'eteeap@conexia.edu'],
        ]);

        DB::statement(<<<'SQL'
            INSERT INTO public.profiles (id, full_name, email, role, department_id, is_active)
            SELECT
                users.id,
                CASE users.email
                    WHEN 'admin@conexia.edu' THEN 'Conexia Super Admin'
                    WHEN 'irostaff@conexia.edu' THEN 'PAIR IRO Staff'
                    WHEN 'iroadmin@conexia.edu' THEN 'PAIR IRO Administrator'
                    WHEN 'legal@conexia.edu' THEN 'Legal Counsel'
                    ELSE UPPER(SPLIT_PART(users.email, '@', 1)) || ' Department Staff'
                END,
                users.email,
                CASE users.email
                    WHEN 'admin@conexia.edu' THEN 'super_admin'
                    WHEN 'irostaff@conexia.edu' THEN 'iro_staff'
                    WHEN 'iroadmin@conexia.edu' THEN 'iro_admin'
                    WHEN 'legal@conexia.edu' THEN 'legal_counsel'
                    ELSE 'department_staff'
                END,
                departments.id,
                TRUE
            FROM auth.users AS users
            LEFT JOIN public.departments AS departments
                ON departments.email = users.email
            WHERE users.email LIKE '%@conexia.edu'
            ON CONFLICT (id) DO NOTHING
        SQL);
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('document_files');
        Schema::dropIfExists('documents');
        Schema::dropIfExists('profiles');
        Schema::dropIfExists('departments');
    }
};
