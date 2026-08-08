<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('documents')
            ->where('documents.status', 'Submitted')
            ->whereExists(function ($query): void {
                $query->selectRaw('1')
                    ->from('engagements')
                    ->join('profiles', 'profiles.id', '=', 'engagements.created_by')
                    ->whereColumn('engagements.document_id', 'documents.id')
                    ->where('profiles.role', 'iro_admin');
            })
            ->update([
                'status' => 'Logged',
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        // Existing workflow records must not be moved backward into Incoming.
    }
};
