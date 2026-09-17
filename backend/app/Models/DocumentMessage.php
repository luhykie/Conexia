<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentMessage extends Model
{
    use HasUuids;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'document_id',
        'sender_id',
        'sender_role',
        'reply_to_message_id',
        'message',
        'is_read',
        'read_at',
    ];

    // Casts message read state and timestamp to native values.
    protected function casts(): array
    {
        return [
            'is_read' => 'boolean',
            'read_at' => 'datetime',
        ];
    }

    // Returns the document conversation containing this message.
    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    // Returns the profile that sent this message.
    public function sender(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'sender_id');
    }

    // Returns the message referenced by this reply.
    public function replyTo(): BelongsTo
    {
        return $this->belongsTo(self::class, 'reply_to_message_id');
    }
}
