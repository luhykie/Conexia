<?php

return [
    // SECURITY: I-keep ang project URL sa backend para sa Supabase API calls.

    'url' => env('SUPABASE_URL'),

    // SECURITY: pwede gamiton sa frontend ang publishable key, pero server-only gihapon ang service-role secret.

    'publishable_key' => env(
        'SUPABASE_PUBLISHABLE_KEY',
        env('SUPABASE_ANON_KEY')
    ),

    // SECURITY: I-keep ang service-role secret sa backend lang para dili ma-leak sa frontend.

    'service_role_key' => env('SUPABASE_SERVICE_ROLE_KEY'),

    // SECURITY: I-keep ang JWT secret sa backend para sa legacy HS256 token verification.

    'jwt_secret' => env('SUPABASE_JWT_SECRET'),

    // DB-NOTE: i-cache kadiyot ang public JWKS keys para dili sige og fetch kada request.

    'jwks_cache_seconds' => env('SUPABASE_JWKS_CACHE_SECONDS', 3600),

    // SECURITY: gamayi ang clock skew para strict ang token checks pero dili ma-false negative.

    'jwt_leeway_seconds' => env('SUPABASE_JWT_LEEWAY_SECONDS', 60),
];
