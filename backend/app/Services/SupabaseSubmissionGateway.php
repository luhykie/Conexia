<?php

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

class SupabaseSubmissionGateway
{
    private function fallbackPath(): string
    {
        return storage_path('app/submissions-fallback.json');
    }

    private function readFallback(): array
    {
        $path = $this->fallbackPath();

        if (! file_exists($path)) {
            return [];
        }

        $decoded = json_decode((string) file_get_contents($path), true);

        return is_array($decoded) ? array_values($decoded) : [];
    }

    private function normalizeRows(array $rows, string $prefix = 'SCS'): array
    {
        $prefix = strtoupper(trim($prefix));
        $counter = 1;

        return array_map(function (array $row) use ($prefix, &$counter) {
            $rowPrefix = $this->prefixForRow($row) ?? $prefix;
            $trackingNumber = (string) ($row['tracking_number'] ?? '');
            if (! preg_match('/^'.preg_quote($rowPrefix, '/').'-[0-9]{5}$/', $trackingNumber)) {
                $row['tracking_number'] = sprintf('%s-%05d', $rowPrefix, $counter);
            }

            $counter++;

            return $row;
        }, $rows);
    }

    private function prefixForRow(array $row): ?string
    {
        $office = strtolower(trim((string) ($row['office'] ?? '')));
        $department = strtolower(trim((string) ($row['department'] ?? '')));

        $map = [
            'school of computer studies' => 'SCS',
            'computer studies' => 'SCS',
            'school of business management' => 'SBM',
            'business management' => 'SBM',
            'school of engineering and architecture' => 'SEA',
            'engineering and architecture' => 'SEA',
            'school of education' => 'SED',
            'education' => 'SED',
            'school of law' => 'SOL',
            'law' => 'SOL',
            'school of arts and sciences' => 'SAS',
            'arts and sciences' => 'SAS',
        ];

        return $map[$office] ?? $map[$department] ?? null;
    }

    private function writeFallback(array $rows): void
    {
        file_put_contents($this->fallbackPath(), json_encode(array_values($rows), JSON_PRETTY_PRINT));
    }

    private function fallbackCreate(array $payload): array
    {
        $rows = $this->readFallback();
        $now = now()->toIso8601String();

        $row = array_merge([
            'id' => (string) Str::uuid(),
            'created_at' => $now,
            'updated_at' => $now,
        ], $payload);

        $rows[] = $row;
        $this->writeFallback($rows);

        return $row;
    }

    public function nextTrackingNumber(string $prefix): string
    {
        $prefix = strtoupper(trim($prefix));
        $pattern = '/^'.preg_quote($prefix, '/').'-([0-9]{5})$/';

        $max = 0;
        foreach ($this->readFallback() as $row) {
            $trackingNumber = (string) ($row['tracking_number'] ?? '');
            if (preg_match($pattern, $trackingNumber, $matches)) {
                $max = max($max, (int) $matches[1]);
            }
        }

        return sprintf('%s-%05d', $prefix, $max + 1);
    }

    private function fallbackUpdate(string $id, array $payload): array
    {
        $rows = $this->readFallback();
        $updated = null;

        foreach ($rows as $index => $row) {
            if (($row['id'] ?? null) !== $id) {
                continue;
            }

            $updated = array_merge($row, $payload, [
                'updated_at' => now()->toIso8601String(),
            ]);
            $rows[$index] = $updated;
            break;
        }

        if (! $updated) {
            throw new RuntimeException('Submission not found in local fallback store.');
        }

        $this->writeFallback($rows);

        return $updated;
    }

    private function fallbackQuery(array $query = []): array
    {
        $rows = $this->normalizeRows($this->readFallback());

        foreach ($query as $key => $value) {
            if ($key === 'submitted_by' && str_starts_with((string) $value, 'eq.')) {
                $needle = substr((string) $value, 3);
                $rows = array_values(array_filter($rows, fn ($row) => (string) ($row['submitted_by'] ?? '') === $needle));
                continue;
            }

            if ($key === 'status' && str_starts_with((string) $value, 'eq.')) {
                $needle = substr((string) $value, 3);
                $rows = array_values(array_filter($rows, fn ($row) => (string) ($row['status'] ?? '') === $needle));
                continue;
            }

            if ($key === 'status' && str_starts_with((string) $value, 'in.(')) {
                $needle = trim(substr((string) $value, 4), '()');
                $allowed = array_map('trim', explode(',', $needle));
                $rows = array_values(array_filter($rows, fn ($row) => in_array((string) ($row['status'] ?? ''), $allowed, true)));
            }
        }

        usort($rows, fn ($a, $b) => strcmp((string) ($b['created_at'] ?? ''), (string) ($a['created_at'] ?? '')));

        return $rows;
    }

    private function client(?string $bearerToken = null): PendingRequest
    {
        $baseUrl = rtrim((string) config('supabase.url'), '/');
        $anonKey = (string) config('supabase.anon_key');
        $serviceKey = (string) config('supabase.service_role_key');

        if (! $baseUrl || (! $anonKey && ! $serviceKey)) {
            throw new RuntimeException('Supabase API is not configured.');
        }

        if (! $serviceKey) {
            throw new RuntimeException('SUPABASE_SERVICE_ROLE_KEY is required for server-side submission access.');
        }

        $headers = [
            'apikey' => $serviceKey,
            'Authorization' => 'Bearer '.$serviceKey,
            'Accept' => 'application/json',
        ];

        return Http::baseUrl($baseUrl)->withHeaders($headers);
    }

    public function listSubmissions(?string $bearerToken, array $query = []): array
    {
        try {
            $response = $this->client($bearerToken)->get('/rest/v1/submissions', array_merge([
                'select' => '*',
                'order' => 'created_at.desc',
                'limit' => 100,
            ], $query));

            if ($response->failed()) {
                throw new RuntimeException($this->formatError($response));
            }

            return $response->json() ?? [];
        } catch (Throwable $e) {
            return $this->fallbackQuery($query);
        }
    }

    public function createSubmission(?string $bearerToken, array $payload): array
    {
        try {
            $response = $this->client($bearerToken)
                ->withHeaders(['Prefer' => 'return=representation'])
                ->post('/rest/v1/submissions', $payload);

            if ($response->failed()) {
                throw new RuntimeException($this->formatError($response));
            }

            return $this->normalizeRows($response->json() ?? []);
        } catch (Throwable $e) {
            return $this->fallbackCreate($payload);
        }
    }

    public function updateSubmission(?string $bearerToken, string $id, array $payload): array
    {
        try {
            $response = $this->client($bearerToken)
                ->withHeaders(['Prefer' => 'return=representation'])
                ->patch("/rest/v1/submissions?id=eq.{$id}", $payload);

            if ($response->failed()) {
                throw new RuntimeException($this->formatError($response));
            }

            return $this->normalizeRows($response->json() ?? []);
        } catch (Throwable $e) {
            return $this->fallbackUpdate($id, $payload);
        }
    }

    public function getSubmission(?string $bearerToken, string $id): ?array
    {
        try {
            $response = $this->client($bearerToken)->get('/rest/v1/submissions', [
                'select' => '*',
                'id' => 'eq.'.$id,
                'limit' => 1,
            ]);

            if ($response->failed()) {
                throw new RuntimeException($this->formatError($response));
            }

            $rows = $this->normalizeRows($response->json() ?? []);

            return is_array($rows) ? ($rows[0] ?? null) : null;
        } catch (Throwable $e) {
            foreach ($this->readFallback() as $row) {
                if (($row['id'] ?? null) === $id) {
                    return $row;
                }
            }

            return null;
        }
    }

    private function formatError($response): string
    {
        $body = $response->json();
        if (is_array($body)) {
            $message = $body['message'] ?? $body['error'] ?? null;
            if ($message) {
                return $message;
            }
        }

        return sprintf('Supabase request failed with HTTP %s.', $response->status());
    }
}
