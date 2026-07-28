<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class ProfileController extends Controller
{
    /**
     * Return active Legal Counsel profiles.
     */
    public function legalCounsels(): JsonResponse
    {
        $legalCounsels = DB::table('profiles')
            ->select(
                'id',
                'full_name',
                'email',
                'role'
            )
            ->where('role', 'legal_counsel')
            ->where('is_active', true)
            ->orderBy('full_name')
            ->get();

        return response()->json([
            'data' => $legalCounsels,
        ]);
    }
}