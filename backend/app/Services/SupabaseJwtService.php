<?php

namespace App\Services;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use stdClass;

class SupabaseJwtService
{
    public function decode(string $token): stdClass
    {
        $secret = config('supabase.jwt_secret');

        if (! $secret) {
            throw new \RuntimeException('SUPABASE_JWT_SECRET is not configured.');
        }

        return JWT::decode($token, new Key($secret, 'HS256'));
    }
}
