<?php

namespace App\Repositories;

use App\Models\AuditLog;
use App\Models\Document;
use App\Models\DocumentFile;
use App\Models\Profile;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use App\Support\Pagination;

class DocumentFileRepository
{
    public function filesForDocument(
        Document $document,
        array $options
    ): LengthAwarePaginator
    {
        return DocumentFile::query()
            ->with('uploader')
            ->where('document_id', $document->id)
            ->whereNull('deleted_at')
            ->when(
                ($options['search'] ?? '') !== '',
                fn ($query) => $query->where(
                    'original_filename',
                    Pagination::searchOperator(),
                    "%{$options['search']}%"
                )
            )
            ->orderBy(
                $options['sort'] ?? 'version',
                $options['direction'] ?? 'desc'
            )
            ->paginate(
                $options['per_page'],
                ['*'],
                'page',
                $options['page']
            );
    }

    public function findActiveFile(
        Document $document,
        string $fileId
    ): ?DocumentFile {
        return DocumentFile::query()
            ->whereKey($fileId)
            ->where('document_id', $document->id)
            ->whereNull('deleted_at')
            ->first();
    }

    public function duplicateExists(
        Document $document,
        string $filename,
        int $size
    ): bool {
        return DocumentFile::query()
            ->where('document_id', $document->id)
            ->where('original_filename', $filename)
            ->where('size', $size)
            ->whereNull('deleted_at')
            ->exists();
    }

    public function nextVersion(Document $document): int
    {
        return ((int) DocumentFile::query()
            ->where('document_id', $document->id)
            ->max('version')) + 1;
    }

    public function create(array $data): DocumentFile
    {
        return DocumentFile::query()->create($data);
    }

    public function markDeleted(DocumentFile $file): DocumentFile
    {
        $file->update(['deleted_at' => now()]);

        return $file->refresh();
    }

    public function log(
        string $action,
        Profile $actor,
        Document $document,
        ?DocumentFile $file = null,
        array $metadata = []
    ): AuditLog {
        return AuditLog::query()->create([
            'actor_id' => $actor->id,
            'document_id' => $document->id,
            'document_file_id' => $file?->id,
            'action' => $action,
            'metadata' => $metadata,
        ]);
    }
}
