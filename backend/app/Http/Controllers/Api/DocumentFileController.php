<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\DocumentFileUploadRequest;
use App\Models\Document;
use App\Models\DocumentFile;
use App\Models\Profile;
use App\Services\DocumentFileService;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Throwable;

class DocumentFileController extends Controller
{
    public function __construct(
        private readonly DocumentFileService $files
    ) {
    }

    public function metadata(
        Request $request,
        Document $document
    ): JsonResponse {
        return $this->runJson(function () use (
            $request,
            $document
        ) {
            $files = $this->files->metadata(
                $document,
                $this->profile($request),
                Pagination::options(
                    $request,
                    ['version', 'created_at', 'original_filename'],
                    'version'
                )
            );

            return $this->success(
                'Document file metadata loaded successfully.',
                $files['items'],
                [
                    'files' => $files['items'],
                    'meta' => $files['meta'],
                ]
            );
        });
    }

    public function upload(
        DocumentFileUploadRequest $request,
        Document $document
    ): JsonResponse {
        return $this->runJson(function () use (
            $request,
            $document
        ) {
            $file = $this->files->upload(
                $document,
                $this->profile($request),
                $request->file('file')
            );

            return $this->success(
                'Document file uploaded successfully.',
                $file,
                ['file' => $file],
                201
            );
        });
    }

    public function download(
        Request $request,
        Document $document,
        string $file
    ): Response {
        return $this->runFile(function () use (
            $request,
            $document,
            $file
        ) {
            $record = $this->files->download(
                $document,
                $this->profile($request),
                $file
            );

            return Storage::disk($record->storage_disk)
                ->download(
                    $record->storage_path,
                    $record->original_filename,
                    $this->headers($record, 'attachment')
                );
        });
    }

    public function preview(
        Request $request,
        Document $document,
        string $file
    ): Response {
        return $this->runFile(function () use (
            $request,
            $document,
            $file
        ) {
            $record = $this->files->preview(
                $document,
                $this->profile($request),
                $file
            );

            $stream = Storage::disk($record->storage_disk)
                ->readStream($record->storage_path);

            return new StreamedResponse(
                function () use ($stream): void {
                    fpassthru($stream);

                    if (is_resource($stream)) {
                        fclose($stream);
                    }
                },
                200,
                $this->headers($record, 'inline')
            );
        });
    }

    public function annotations(
        Request $request,
        Document $document,
        string $file
    ): JsonResponse {
        return $this->runJson(function () use ($request, $document, $file) {
            $annotations = $this->files->annotations(
                $document,
                $this->profile($request),
                $file
            );

            return $this->success(
                'Document annotations loaded successfully.',
                $annotations,
                ['annotations' => $annotations]
            );
        });
    }

    public function annotate(
        Request $request,
        Document $document,
        string $file
    ): JsonResponse {
        return $this->runJson(function () use ($request, $document, $file) {
            $validated = $request->validate([
                'highlight' => ['required', 'string', 'max:2000'],
                'comment' => ['required', 'string', 'max:2000'],
                'geometry' => ['required', 'array'],
                'geometry.page' => ['required', 'integer', 'min:1'],
                'geometry.rects' => ['required', 'array', 'min:1', 'max:100'],
                'geometry.rects.*.x' => ['required', 'numeric', 'between:0,1'],
                'geometry.rects.*.y' => ['required', 'numeric', 'between:0,1'],
                'geometry.rects.*.width' => ['required', 'numeric', 'gt:0', 'max:1'],
                'geometry.rects.*.height' => ['required', 'numeric', 'gt:0', 'max:1'],
            ]);
            $annotation = $this->files->annotate(
                $document,
                $this->profile($request),
                $file,
                $validated
            );

            return $this->success(
                'Document annotation saved successfully.',
                $annotation,
                ['annotation' => $annotation],
                201
            );
        });
    }

    public function updateAnnotation(
        Request $request,
        Document $document,
        string $file,
        string $annotation
    ): JsonResponse {
        return $this->runJson(function () use ($request, $document, $file, $annotation) {
            $validated = $request->validate([
                'comment' => ['required', 'string', 'max:2000'],
            ]);
            $updated = $this->files->updateAnnotationComment(
                $document,
                $this->profile($request),
                $file,
                $annotation,
                $validated['comment']
            );

            return $this->success('Annotation comment updated successfully.', $updated, ['annotation' => $updated]);
        });
    }

    public function removeAnnotation(
        Request $request,
        Document $document,
        string $file,
        string $annotation
    ): JsonResponse {
        return $this->runJson(function () use ($request, $document, $file, $annotation) {
            $removed = $this->files->removeAnnotation(
                $document,
                $this->profile($request),
                $file,
                $annotation
            );

            return $this->success('Annotation removed successfully.', $removed, ['annotation' => $removed]);
        });
    }

    public function delete(
        Request $request,
        Document $document,
        string $file
    ): JsonResponse {
        return $this->runJson(function () use (
            $request,
            $document,
            $file
        ) {
            $deletedFile = $this->files->delete(
                $document,
                $this->profile($request),
                $file
            );

            return $this->success(
                'Document file deleted successfully.',
                $deletedFile,
                ['file' => $deletedFile]
            );
        });
    }

    private function profile(Request $request): Profile
    {
        return $request->attributes->get(
            'authenticated_profile'
        );
    }

    private function headers(
        DocumentFile $file,
        string $disposition
    ): array {
        return [
            'Content-Type' => $file->mime_type,
            'Content-Length' => (string) $file->size,
            'Content-Disposition' => sprintf(
                '%s; filename="%s"',
                $disposition,
                addslashes($file->original_filename)
            ),
            'X-Content-Type-Options' => 'nosniff',
        ];
    }

    private function success(
        string $message,
        mixed $data,
        array $extra = [],
        int $status = 200
    ): JsonResponse {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $data,
            ...$extra,
        ], $status);
    }

    private function runJson(callable $action): JsonResponse
    {
        try {
            return $action();
        } catch (ValidationException $exception) {
            return response()->json([
                'success' => false,
                'message' => 'The document file request is invalid.',
                'errors' => $exception->errors(),
            ], 422);
        } catch (NotFoundHttpException) {
            return response()->json([
                'success' => false,
                'message' => 'The requested document file could not be found.',
                'errors' => [],
            ], 404);
        } catch (Throwable $exception) {
            Log::error(
                'Document file API request failed.',
                ['exception' => $exception]
            );

            return response()->json([
                'success' => false,
                'message' => 'An unexpected server error occurred.',
                'errors' => [],
            ], 500);
        }
    }

    private function runFile(callable $action): Response
    {
        try {
            return $action();
        } catch (ValidationException $exception) {
            return response()->json([
                'success' => false,
                'message' => 'The document file request is invalid.',
                'errors' => $exception->errors(),
            ], 422);
        } catch (NotFoundHttpException) {
            return response()->json([
                'success' => false,
                'message' => 'The requested document file could not be found.',
                'errors' => [],
            ], 404);
        } catch (Throwable $exception) {
            Log::error(
                'Document file stream failed.',
                ['exception' => $exception]
            );

            return response()->json([
                'success' => false,
                'message' => 'An unexpected server error occurred.',
                'errors' => [],
            ], 500);
        }
    }
}
