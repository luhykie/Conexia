<?php

namespace App\Services;

use App\Models\Document;
use App\Models\DocumentFile;
use App\Models\Profile;
use App\Repositories\DocumentFileRepository;
use App\Support\Pagination;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class DocumentFileService
{
    private const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'odt'];
    private const PREVIEW_MIME_TYPES = [
        'application/pdf',
        'text/plain',
    ];

    public function __construct(
        private readonly DocumentFileRepository $files
    ) {
    }

    public function metadata(
        Document $document,
        Profile $actor,
        array $options
    ): array {
        $this->authorizeView($actor, $document);

        $records = $this->files
            ->filesForDocument($document, $options);

        $items = $records
            ->map(fn (DocumentFile $file): array =>
                $this->payload($file)
            )
            ->values()
            ->all();

        $this->files->log(
            'document_file.metadata',
            $actor,
            $document
        );

        return [
            'items' => $items,
            'meta' => Pagination::meta($records),
        ];
    }

    public function upload(
        Document $document,
        Profile $actor,
        UploadedFile $upload
    ): array {
        $this->authorizeModify($actor, $document);

        $originalName = $this->sanitizeFilename(
            $upload->getClientOriginalName()
        );

        $extension = strtolower(
            $upload->getClientOriginalExtension()
        );

        if (!in_array($extension, self::ALLOWED_EXTENSIONS, true)) {
            throw ValidationException::withMessages([
                'file' => 'This file extension is not allowed.',
            ]);
        }

        if (
            preg_match(
                '/\.(php|phtml|phar|exe|bat|cmd|js|sh)(\.|$)/i',
                $upload->getClientOriginalName()
            )
        ) {
            throw ValidationException::withMessages([
                'file' => 'This filename is not allowed.',
            ]);
        }

        if (
            $this->files->duplicateExists(
                $document,
                $originalName,
                (int) $upload->getSize()
            )
        ) {
            throw ValidationException::withMessages([
                'file' => 'This file has already been uploaded.',
            ]);
        }

        return DB::transaction(function () use (
            $document,
            $actor,
            $upload,
            $originalName,
            $extension
        ): array {
            $disk = config(
                'filesystems.document_disk',
                config('filesystems.default', 'local')
            );

            $version = $this->files->nextVersion($document);

            $storedName = Str::uuid().'.'.$extension;
            $path = "documents/{$document->id}/{$storedName}";

            Storage::disk($disk)->putFileAs(
                "documents/{$document->id}",
                $upload,
                $storedName
            );

            $file = $this->files->create([
                'document_id' => $document->id,
                'uploaded_by' => $actor->id,
                'original_filename' => $originalName,
                'stored_filename' => $storedName,
                'storage_disk' => $disk,
                'storage_path' => $path,
                'mime_type' => $upload->getMimeType(),
                'size' => (int) $upload->getSize(),
                'version' => $version,
            ]);

            $this->files->log(
                'document_file.uploaded',
                $actor,
                $document,
                $file,
                ['filename' => $originalName]
            );

            return $this->payload($file);
        });
    }

    public function download(
        Document $document,
        Profile $actor,
        string $fileId
    ): DocumentFile {
        $file = $this->fileForAccess($document, $actor, $fileId);

        $this->files->log(
            'document_file.downloaded',
            $actor,
            $document,
            $file
        );

        return $file;
    }

    public function preview(
        Document $document,
        Profile $actor,
        string $fileId
    ): DocumentFile {
        $file = $this->fileForAccess($document, $actor, $fileId);

        if (!in_array($file->mime_type, self::PREVIEW_MIME_TYPES, true)) {
            throw ValidationException::withMessages([
                'file' => 'This file type cannot be previewed in the browser.',
            ]);
        }

        $this->files->log(
            'document_file.previewed',
            $actor,
            $document,
            $file
        );

        return $file;
    }

    public function delete(
        Document $document,
        Profile $actor,
        string $fileId
    ): array {
        $this->authorizeModify($actor, $document);

        $file = $this->files->findActiveFile($document, $fileId);

        if (!$file) {
            throw new NotFoundHttpException(
                'The requested file could not be found.'
            );
        }

        if (
            !in_array($document->status, [
                Document::STATUS_SUBMITTED,
                Document::STATUS_CORRECTIONS_NEEDED,
            ], true)
        ) {
            throw ValidationException::withMessages([
                'document' => 'Files cannot be deleted at this workflow stage.',
            ]);
        }

        return DB::transaction(function () use (
            $document,
            $actor,
            $file
        ): array {
            Storage::disk($file->storage_disk)
                ->delete($file->storage_path);

            $deletedFile = $this->files->markDeleted($file);

            $this->files->log(
                'document_file.deleted',
                $actor,
                $document,
                $deletedFile
            );

            return $this->payload($deletedFile);
        });
    }

    public function payload(DocumentFile $file): array
    {
        $file->loadMissing('uploader');

        return [
            'id' => $file->id,
            'document_id' => $file->document_id,
            'filename' => $file->original_filename,
            'size' => $file->size,
            'mime_type' => $file->mime_type,
            'version' => $file->version,
            'uploaded_at' => $file->created_at?->toISOString(),
            'uploaded_by' => $file->uploaded_by,
            'uploader' => $file->uploader
                ? [
                    'id' => $file->uploader->id,
                    'name' => $file->uploader->full_name,
                    'email' => $file->uploader->email,
                ]
                : null,
        ];
    }

    private function fileForAccess(
        Document $document,
        Profile $actor,
        string $fileId
    ): DocumentFile {
        $this->authorizeView($actor, $document);

        $file = $this->files->findActiveFile($document, $fileId);

        if (!$file) {
            throw new NotFoundHttpException(
                'The requested file could not be found.'
            );
        }

        if (
            !Storage::disk($file->storage_disk)
                ->exists($file->storage_path)
        ) {
            throw new NotFoundHttpException(
                'The requested file could not be found.'
            );
        }

        return $file;
    }

    private function authorizeView(
        Profile $actor,
        Document $document
    ): void {
        if (
            Gate::forUser($actor)->denies(
                'view-document-metadata',
                $document
            )
        ) {
            throw new NotFoundHttpException(
                'The requested document could not be found.'
            );
        }
    }

    private function authorizeModify(
        Profile $actor,
        Document $document
    ): void {
        $this->authorizeView($actor, $document);

        if ($document->status === Document::STATUS_ARCHIVED) {
            throw ValidationException::withMessages([
                'document' => 'Archived documents cannot be modified.',
            ]);
        }
    }

    private function sanitizeFilename(string $filename): string
    {
        $name = trim(str_replace('\\', '/', $filename));
        $name = basename($name);
        $name = preg_replace('/[^A-Za-z0-9._ -]/', '_', $name);
        $name = preg_replace('/\s+/', ' ', $name);

        return trim($name, ' .') ?: 'document';
    }
}
