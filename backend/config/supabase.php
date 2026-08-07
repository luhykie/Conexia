<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Supabase project URL
    |--------------------------------------------------------------------------
    |
    | Example:
    | https://your-project-reference.supabase.co
    |
    */

    'url' => env('SUPABASE_URL'),

    /*
    |--------------------------------------------------------------------------
    | Supabase publishable key
    |--------------------------------------------------------------------------
    |
    | This is the same publishable/anon key used by the React frontend.
    | Do not place the service-role key in the frontend.
    |
    */

    'publishable_key' => env(
        'SUPABASE_PUBLISHABLE_KEY',
        env('SUPABASE_ANON_KEY')
    ),

    /*
    |--------------------------------------------------------------------------
    | Supabase JWT secret
    |--------------------------------------------------------------------------
    |
    | Older Supabase projects can issue HS256 access tokens. Keep this only on
    | the Laravel backend and never expose it to the React frontend.
    |
    */

    'jwt_secret' => env('SUPABASE_JWT_SECRET'),

    /*
    |--------------------------------------------------------------------------
    | Supabase JWKS cache time
    |--------------------------------------------------------------------------
    |
    | Supabase Auth publishes public keys for ES256 JWT verification.
    | Cache them briefly so every API request does not fetch the key set.
    |
    */

    'jwks_cache_seconds' => env('SUPABASE_JWKS_CACHE_SECONDS', 3600),
];
