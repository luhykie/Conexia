<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class DocumentFile extends Model
{
    protected $table = 'document_files';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'document_id',
        'uploaded_by',
        'original_filename',
        'stored_filename',
        'storage_disk',
        'storage_path',
        'mime_type',
        'size',
        'version',
    ];

    protected static function booted(): void
    {
        static::creating(function (DocumentFile $file): void {
            $file->id ??= (string) Str::uuid();
        });
    }
}
