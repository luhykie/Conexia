<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('notifications')) {
            Schema::create('notifications', function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->uuid('user_id');
                $table->uuid('document_id')->nullable();
                $table->string('notification_type');
                $table->string('title');
                $table->text('message');
                $table->string('dedupe_key')->unique();
                $table->boolean('is_read')->default(false);
                $table->timestampTz('created_at')->useCurrent();
                $table->timestampTz('read_at')->nullable();

                $table->foreign('user_id')->references('id')->on('profiles')->cascadeOnDelete();
                $table->foreign('document_id')->references('id')->on('documents')->cascadeOnDelete();
                $table->index(['user_id', 'is_read', 'created_at']);
            });

            return;
        }

        Schema::table('notifications', function (Blueprint $table): void {
            if (! Schema::hasColumn('notifications', 'dedupe_key')) {
                $table->string('dedupe_key')->nullable()->unique();
            }
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('notifications', 'dedupe_key')) {
            Schema::table('notifications', function (Blueprint $table): void {
                $table->dropUnique(['dedupe_key']);
                $table->dropColumn('dedupe_key');
            });
        }
    }
};
