<?php

namespace App\Services;

use App\Models\Document;
use App\Models\DocumentFile;
use App\Models\AuditLog;
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

        $items = collect($records->items())
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

            if ($version === 1 && $document->partner_department_id) {
                $this->files->log(
                    'department.review.routed',
                    $actor,
                    $document,
                    $file,
                    ['review_version' => $document->department_review_version]
                );
            }

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

    public function annotations(
        Document $document,
        Profile $actor,
        string $fileId
    ): array {
        $this->authorizeAnnotation($actor);
        $this->authorizeAnnotationView($actor);
        $this->authorizeAnnotationViewStage($document);
        $file = $this->fileForAccess($document, $actor, $fileId);

        $events = AuditLog::query()
            ->with('actor')
            ->where('document_id', $document->id)
            ->where('document_file_id', $file->id)
            ->whereIn('action', [
                'document_file.annotated',
                'document_file.annotation_comment_updated',
                'document_file.annotation_removed',
            ])
            ->oldest('created_at')
            ->get();

        $changes = $events
            ->whereIn('action', [
                'document_file.annotation_comment_updated',
                'document_file.annotation_removed',
            ])
            ->groupBy(fn (AuditLog $event) => $event->metadata['annotation_id'] ?? '');

        return $events
            ->where('action', 'document_file.annotated')
            ->reject(function (AuditLog $annotation) use ($changes): bool {
                return $changes->get($annotation->id)?->contains(
                    fn (AuditLog $event) => $event->action === 'document_file.annotation_removed'
                ) ?? false;
            })
            ->map(function (AuditLog $annotation) use ($changes, $document, $file): array {
                $latestUpdate = $changes->get($annotation->id)?->last(
                    fn (AuditLog $event) => $event->action === 'document_file.annotation_comment_updated'
                );

                return [
                'id' => $annotation->id,
                'highlight' => $annotation->metadata['highlight'] ?? '',
                'comment' => $latestUpdate?->metadata['new_comment']
                    ?? $annotation->metadata['comment']
                    ?? '',
                'geometry' => $annotation->metadata['geometry'] ?? null,
                'reviewer_id' => $annotation->actor_id,
                'document_id' => $document->id,
                'document_file_id' => $file->id,
                'version' => $annotation->metadata['version'] ?? $file->version,
                'created_at' => $annotation->created_at?->toISOString(),
                'updated_at' => $latestUpdate?->created_at?->toISOString(),
                'author' => $annotation->actor?->full_name ?: $annotation->actor?->email,
                ];
            })
            ->sortByDesc('created_at')
            ->values()
            ->all();
    }

    public function annotate(
        Document $document,
        Profile $actor,
        string $fileId,
        array $data
    ): array {
        $this->authorizeAnnotation($actor);
        $this->authorizeReviewStage($document);
        $file = $this->fileForAccess($document, $actor, $fileId);

        $annotation = $this->files->log(
            'document_file.annotated',
            $actor,
            $document,
            $file,
            [
                'highlight' => trim($data['highlight']),
                'comment' => trim($data['comment']),
                'geometry' => $data['geometry'],
                'version' => $file->version,
            ]
        );

        return [
            'id' => $annotation->id,
            'highlight' => $annotation->metadata['highlight'],
            'comment' => $annotation->metadata['comment'],
            'geometry' => $annotation->metadata['geometry'],
            'version' => $annotation->metadata['version'],
            'created_at' => $annotation->created_at?->toISOString(),
            'author' => $actor->full_name ?: $actor->email,
        ];
    }

    public function updateAnnotationComment(
        Document $document,
        Profile $actor,
        string $fileId,
        string $annotationId,
        string $comment
    ): array {
        $this->authorizeAnnotation($actor);

        return DB::transaction(function () use ($document, $actor, $fileId, $annotationId, $comment): array {
            $lockedDocument = Document::query()->lockForUpdate()->findOrFail($document->id);
            $this->authorizeReviewStage($lockedDocument);
            $file = $this->fileForAccess($lockedDocument, $actor, $fileId);
            $annotation = $this->activeAnnotation($lockedDocument, $file, $annotationId);
            $currentComment = $this->resolvedAnnotationComment($annotation);
            $newComment = trim($comment);

            $event = $this->files->log(
                'document_file.annotation_comment_updated',
                $actor,
                $lockedDocument,
                $file,
                [
                    'annotation_id' => $annotation->id,
                    'previous_comment' => $currentComment,
                    'new_comment' => $newComment,
                ]
            );

            return [
                'id' => $annotation->id,
                'comment' => $newComment,
                'updated_at' => $event->created_at?->toISOString(),
                'updated_by' => $actor->full_name ?: $actor->email,
            ];
        });
    }

    public function removeAnnotation(
        Document $document,
        Profile $actor,
        string $fileId,
        string $annotationId
    ): array {
        $this->authorizeAnnotation($actor);

        return DB::transaction(function () use ($document, $actor, $fileId, $annotationId): array {
            $lockedDocument = Document::query()->lockForUpdate()->findOrFail($document->id);
            $this->authorizeReviewStage($lockedDocument);
            $file = $this->fileForAccess($lockedDocument, $actor, $fileId);
            $annotation = $this->activeAnnotation($lockedDocument, $file, $annotationId);

            $event = $this->files->log(
                'document_file.annotation_removed',
                $actor,
                $lockedDocument,
                $file,
                [
                    'annotation_id' => $annotation->id,
                    'highlight' => $annotation->metadata['highlight'] ?? '',
                    'comment' => $this->resolvedAnnotationComment($annotation),
                    'geometry' => $annotation->metadata['geometry'] ?? null,
                    'removed_at' => now()->toISOString(),
                ]
            );

            return [
                'id' => $annotation->id,
                'removed_at' => $event->created_at?->toISOString(),
                'removed_by' => $actor->full_name ?: $actor->email,
            ];
        });
    }

    private function activeAnnotation(
        Document $document,
        DocumentFile $file,
        string $annotationId
    ): AuditLog {
        $annotation = AuditLog::query()
            ->whereKey($annotationId)
            ->where('document_id', $document->id)
            ->where('document_file_id', $file->id)
            ->where('action', 'document_file.annotated')
            ->first();

        $removed = $annotation && AuditLog::query()
            ->where('document_id', $document->id)
            ->where('document_file_id', $file->id)
            ->where('action', 'document_file.annotation_removed')
            ->where('metadata->annotation_id', $annotation->id)
            ->exists();

        if (!$annotation || $removed) {
            throw new NotFoundHttpException('The requested annotation could not be found.');
        }

        return $annotation;
    }

    private function resolvedAnnotationComment(AuditLog $annotation): string
    {
        return (string) (AuditLog::query()
            ->where('document_id', $annotation->document_id)
            ->where('document_file_id', $annotation->document_file_id)
            ->where('action', 'document_file.annotation_comment_updated')
            ->where('metadata->annotation_id', $annotation->id)
            ->latest('created_at')
            ->value('metadata->new_comment')
            ?? $annotation->metadata['comment']
            ?? '');
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

        if ($document->partner_department_id && $document->status === Document::STATUS_DEPARTMENT_REVIEW && $actor->role === Profile::ROLE_DEPARTMENT_STAFF && DocumentFile::query()->where('document_id', $document->id)->whereNull('deleted_at')->exists()) {
            throw ValidationException::withMessages(['document' => 'Submitted files are locked while the partner department is reviewing them.']);
        }

        if (
            $document->partner_department_id &&
            $actor->role === Profile::ROLE_DEPARTMENT_STAFF &&
            $actor->department_id !== $document->department_id
        ) {
            throw ValidationException::withMessages([
                'document' => 'Only the submitting department can replace or delete shared files.',
            ]);
        }

        if ($document->status === Document::STATUS_ARCHIVED) {
            throw ValidationException::withMessages([
                'document' => 'Archived documents cannot be modified.',
            ]);
        }
    }

    private function authorizeAnnotation(Profile $actor): void
    {
        if (!in_array($actor->role, [
            Profile::ROLE_IRO_ADMIN,
            Profile::ROLE_LEGAL_COUNSEL,
        ], true)) {
            throw new NotFoundHttpException(
                'The requested document could not be found.'
            );
        }
    }

    private function authorizeAnnotationView(Profile $actor): void
    {
        if (!in_array($actor->role, [
            Profile::ROLE_IRO_ADMIN,
            Profile::ROLE_LEGAL_COUNSEL,
        ], true)) {
            throw new NotFoundHttpException(
                'The requested document could not be found.'
            );
        }
    }

    private function authorizeReviewStage(Document $document): void
    {
        if (!in_array($document->status, [
            Document::STATUS_LOGGED,
            Document::STATUS_UNDER_LEGAL_REVIEW,
        ], true)) {
            throw new NotFoundHttpException(
                'The requested document could not be found.'
            );
        }
    }

    private function authorizeAnnotationViewStage(Document $document): void
    {
        if (!in_array($document->status, [
            Document::STATUS_LOGGED,
            Document::STATUS_CORRECTIONS_NEEDED,
            Document::STATUS_UNDER_LEGAL_REVIEW,
        ], true)) {
            throw new NotFoundHttpException(
                'The requested document is not available for administrative review.'
            );
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
