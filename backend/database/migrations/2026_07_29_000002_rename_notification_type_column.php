<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (
            Schema::hasTable('notifications')
            && Schema::hasColumn('notifications', 'notification_type')
            && ! Schema::hasColumn('notifications', 'type')
        ) {
            Schema::table('notifications', function (Blueprint $table): void {
                $table->renameColumn('notification_type', 'type');
            });
        }
    }

    public function down(): void
    {
        if (
            Schema::hasTable('notifications')
            && Schema::hasColumn('notifications', 'type')
            && ! Schema::hasColumn('notifications', 'notification_type')
        ) {
            Schema::table('notifications', function (Blueprint $table): void {
                $table->renameColumn('type', 'notification_type');
            });
        }
    }
};
