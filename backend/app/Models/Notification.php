<?php
// [FEATURE: Notifications] - loads, formats, and presents workflow notifications.

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Notification extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    public const CREATED_AT = 'created_at';

    public const UPDATED_AT = null;

    protected $fillable = [
        'user_id',
        'document_id',
        'title',
        'message',
        'notification_type',
        'is_read',
        'read_at',
    ];

    // Renders the page for the workflow notifications workflow.
    protected function casts(): array
    {
        return [
            'is_read' => 'boolean',
            'created_at' => 'datetime',
            'read_at' => 'datetime',
        ];
    }

    // Renders the page for the workflow notifications workflow.
    public function user(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'user_id');
    }

    // Renders the page for the workflow notifications workflow.
    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }
}
