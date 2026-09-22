<?php
// Audit log model: sayon i-query ang actor, document, ug file relations.

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    public const UPDATED_AT = null;

    protected $fillable = [
        'actor_id',
        'document_id',
        'document_file_id',
        'action',
        'metadata',
    ];

    // I-keep nga consistent ang JSON payloads ug timestamp casting sa audit entries.
    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'created_at' => 'datetime',
        ];
    }

    // I-expose ang actor profile nga naka-link sa matag audit entry.
    public function actor(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'actor_id');
    }

    // I-expose ang main document nga naka-link ani nga audit entry.
    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    // I-expose ang uploaded file reference nga naka-link ani nga audit entry.
    public function documentFile(): BelongsTo
    {
        return $this->belongsTo(DocumentFile::class);
    }
}
