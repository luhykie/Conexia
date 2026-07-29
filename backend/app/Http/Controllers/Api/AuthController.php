<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProfileResource;
use App\Models\Profile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    /**
     * Return the currently authenticated CONEXIA account.
     */
    public function me(Request $request): JsonResponse
    {
        /** @var Profile|null $profile */
        $profile = $request->attributes->get(
            'authenticated_profile'
        );

        if (!$profile) {
            return response()->json([
                'ok' => false,
                'message' => 'Authenticated profile is unavailable.',
            ], 401);
        }

        return response()->json([
            'ok' => true,
            'account' => new ProfileResource($profile),
        ]);
    }
}