<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_messages', function (Blueprint $table) {
            $table->uuid('reply_to_message_id')->nullable()->after('sender_role');
            $table->foreign('reply_to_message_id')
                ->references('id')
                ->on('document_messages')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('document_messages', function (Blueprint $table) {
            $table->dropForeign(['reply_to_message_id']);
            $table->dropColumn('reply_to_message_id');
        });
    }
};
