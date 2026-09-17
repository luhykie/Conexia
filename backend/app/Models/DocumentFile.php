<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentFile extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

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
        'deleted_at',
    ];

    // Casts the file version and deletion timestamp to native values.
    protected function casts(): array
    {
        return [
            'size' => 'integer',
            'version' => 'integer',
            'deleted_at' => 'datetime',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    // Returns the document that owns this file.
    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    // Returns the profile that uploaded this file.
    public function uploader(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'uploaded_by');
    }
}
