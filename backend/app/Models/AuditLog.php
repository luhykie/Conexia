<?php
// [FEATURE: Audit Log] - records or presents administrative audit activity.

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

    // Renders the page for the administrative audit activity workflow.
    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'created_at' => 'datetime',
        ];
    }

    // Renders the page for the administrative audit activity workflow.
    public function actor(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'actor_id');
    }

    // Renders the page for the administrative audit activity workflow.
    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    // Coordinates file within the administrative audit activity workflow.
    public function documentFile(): BelongsTo
    {
        return $this->belongsTo(DocumentFile::class);
    }
}
