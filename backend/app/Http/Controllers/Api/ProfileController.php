<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ProfileController extends Controller
{
    public function iroStaff(): JsonResponse
    {
        $query = DB::table('profiles')->orderBy('full_name');
        $profiles = Schema::hasColumn('profiles', 'role_key')
            ? $query->select('id', 'full_name', 'role', 'role_key', 'office', 'department')
                ->where('role_key', 'staff')->where('status', 'active')->get()
            : $query->select('id', 'full_name', 'email', 'role', 'department_id')
                ->where('role', 'iro_staff')->where('is_active', true)->get();

        return response()->json(['data' => $profiles]);
    }

    /**
     * Return active Legal Counsel profiles.
     */
    public function legalCounsels(): JsonResponse
    {
        $query = DB::table('profiles')->orderBy('full_name');
        $legalCounsels = Schema::hasColumn('profiles', 'role_key')
            ? $query->select('id', 'full_name', 'role', 'role_key', 'office', 'department')
                ->where('role_key', 'legal')->where('status', 'active')->get()
            : $query->select('id', 'full_name', 'email', 'role', 'department_id')
                ->where('role', 'legal_counsel')->where('is_active', true)->get();

        return response()->json([
            'data' => $legalCounsels,
        ]);
    }
}
