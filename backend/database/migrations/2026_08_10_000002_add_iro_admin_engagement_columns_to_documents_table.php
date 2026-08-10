<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table): void {
            if (!Schema::hasColumn('documents', 'partnership_type')) {
                $table->string('partnership_type')->nullable();
            }

            if (!Schema::hasColumn('documents', 'partnership_scope')) {
                $table->string('partnership_scope')->nullable();
            }

            if (!Schema::hasColumn('documents', 'contact_person')) {
                $table->string('contact_person')->nullable();
            }

            if (!Schema::hasColumn('documents', 'contact_position')) {
                $table->string('contact_position')->nullable();
            }

            if (!Schema::hasColumn('documents', 'contact_email')) {
                $table->string('contact_email')->nullable();
            }

            if (!Schema::hasColumn('documents', 'contact_number')) {
                $table->string('contact_number')->nullable();
            }

            if (!Schema::hasColumn('documents', 'urgency')) {
                $table->string('urgency')->nullable();
            }

            if (!Schema::hasColumn('documents', 'requested_completion_date')) {
                $table->date('requested_completion_date')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table): void {
            if (Schema::hasColumn('documents', 'partnership_type')) {
                $table->dropColumn('partnership_type');
            }

            if (Schema::hasColumn('documents', 'partnership_scope')) {
                $table->dropColumn('partnership_scope');
            }

            if (Schema::hasColumn('documents', 'contact_person')) {
                $table->dropColumn('contact_person');
            }

            if (Schema::hasColumn('documents', 'contact_position')) {
                $table->dropColumn('contact_position');
            }

            if (Schema::hasColumn('documents', 'contact_email')) {
                $table->dropColumn('contact_email');
            }

            if (Schema::hasColumn('documents', 'contact_number')) {
                $table->dropColumn('contact_number');
            }

            if (Schema::hasColumn('documents', 'urgency')) {
                $table->dropColumn('urgency');
            }

            if (Schema::hasColumn('documents', 'requested_completion_date')) {
                $table->dropColumn('requested_completion_date');
            }
        });
    }
};
