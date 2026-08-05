<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class SubmissionFileController extends Controller
{
    private const CATEGORIES = [
        'original_draft',
        'correction',
        'partner_revision',
        'signed_copy',
        'notarized_copy',
        'supporting_document',
    ];

    public function index(Request $request, string $submissionId): JsonResponse
    {
        $response = $this->client($request)->get('/rest/v1/submission_versions', [
            'select' => 'id,submission_id,version_number,file_name,upload_reason,mime_type,file_size,notes,created_at',
            'submission_id' => 'eq.'.$submissionId,
            'order' => 'version_number.desc',
        ]);

        if (! $response->successful()) {
            return $this->gatewayError($response, 'Unable to load submission files.');
        }

        return response()->json(['data' => $response->json() ?? []]);
    }

    public function store(Request $request, string $submissionId): JsonResponse
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'max:25600', 'mimes:pdf,doc,docx,odt'],
            'category' => ['required', 'string', 'in:'.implode(',', self::CATEGORIES)],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $file = $validated['file'];
        $extension = strtolower((string) $file->getClientOriginalExtension());
        $storedName = (string) Str::uuid().($extension === '' ? '' : '.'.$extension);
        $storagePath = $submissionId.'/'.$storedName;
        $bucket = $this->bucket();
        $objectUrl = '/storage/v1/object/'.$bucket.'/'.$this->encodePath($storagePath);

        $upload = $this->client($request)
            ->withHeaders(['x-upsert' => 'false'])
            ->withBody((string) file_get_contents($file->getRealPath()), $file->getMimeType() ?: 'application/octet-stream')
            ->post($objectUrl);

        if (! $upload->successful()) {
            return $this->gatewayError($upload, 'Unable to store the submission file.');
        }

        $registration = $this->client($request)->post(
            '/rest/v1/rpc/register_submission_version',
            [
                'p_submission_id' => $submissionId,
                'p_storage_path' => $storagePath,
                'p_file_name' => $file->getClientOriginalName(),
                'p_upload_reason' => $validated['category'],
                'p_mime_type' => $file->getMimeType(),
                'p_file_size' => $file->getSize(),
                'p_notes' => $validated['notes'] ?? null,
            ]
        );

        if (! $registration->successful()) {
            // Avoid leaving an unregistered object behind if metadata creation
            // fails after the Storage upload succeeds.
            $this->client($request)->delete($objectUrl);

            return $this->gatewayError(
                $registration,
                'The file was uploaded but its version could not be registered.'
            );
        }

        return response()->json([
            'message' => 'Submission file stored securely.',
            'data' => $registration->json(),
        ], 201);
    }

    public function show(
        Request $request,
        string $submissionId,
        string $versionId
    ): Response {
        $metadata = $this->client($request)->get('/rest/v1/submission_versions', [
            'select' => 'id,submission_id,storage_path,file_name,mime_type',
            'id' => 'eq.'.$versionId,
            'submission_id' => 'eq.'.$submissionId,
            'limit' => 1,
        ]);

        if (! $metadata->successful()) {
            return $this->gatewayError($metadata, 'Unable to retrieve the file metadata.');
        }

        $version = ($metadata->json() ?? [])[0] ?? null;
        if (! is_array($version)) {
            return response()->json(['message' => 'Submission file not found.'], 404);
        }

        $download = $this->client($request)->get(
            '/storage/v1/object/authenticated/'.$this->bucket().'/'.$this->encodePath($version['storage_path'])
        );

        if (! $download->successful()) {
            return $this->gatewayError($download, 'Unable to retrieve the submission file.');
        }

        $safeName = str_replace(["\r", "\n", '"'], '', (string) $version['file_name']);

        return response($download->body(), 200, [
            'Content-Type' => $version['mime_type'] ?: 'application/octet-stream',
            'Content-Disposition' => 'inline; filename="'.$safeName.'"',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    private function client(Request $request): PendingRequest
    {
        $url = rtrim((string) config('services.supabase.url'), '/');
        $anonKey = (string) config('services.supabase.anon_key');

        abort_if($url === '' || $anonKey === '', 500, 'Supabase API is not configured.');

        return Http::baseUrl($url)
            ->acceptJson()
            ->withHeaders(['apikey' => $anonKey])
            ->withToken((string) $request->bearerToken())
            ->timeout(30);
    }

    private function bucket(): string
    {
        return trim((string) config('services.supabase.storage_bucket', 'submissions'));
    }

    private function encodePath(string $path): string
    {
        return implode('/', array_map('rawurlencode', explode('/', $path)));
    }

    private function gatewayError($response, string $fallback): JsonResponse
    {
        return response()->json([
            'message' => $response->json('message') ?: $fallback,
        ], $response->status() >= 500 ? 502 : ($response->status() === 404 ? 404 : 422));
    }
}
