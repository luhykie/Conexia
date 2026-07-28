<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class SupabaseStorageService
{
    public function signedUrl(string $path, int $expiresInSeconds = 300): string
    {
        $baseUrl = rtrim((string) config('supabase.url'), '/');
        $bucket = config('supabase.storage_bucket');
        $serviceKey = config('supabase.service_role_key');

        if (! $baseUrl || ! $serviceKey) {
            throw new \RuntimeException('Supabase storage is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
        }

        $response = Http::withHeaders([
            'apikey' => $serviceKey,
            'Authorization' => "Bearer {$serviceKey}",
        ])->post("{$baseUrl}/storage/v1/object/sign/{$bucket}/" . ltrim($path, '/'), [
            'expiresIn' => $expiresInSeconds,
        ]);

        if ($response->failed()) {
            throw new \RuntimeException('Unable to generate a signed URL for this file: ' . $response->body());
        }

        $signedPath = $response->json('signedURL');

        if (! $signedPath) {
            throw new \RuntimeException('Supabase did not return a signed URL for this file.');
        }

        return "{$baseUrl}/storage/v1{$signedPath}";
    }
}
