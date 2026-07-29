<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class Notification extends Model
{
    protected $table = 'notifications';

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'document_id',
        'type',
        'title',
        'message',
        'dedupe_key',
        'is_read',
        'created_at',
        'read_at',
    ];

    protected function casts(): array
    {
        return [
            'is_read' => 'boolean',
            'created_at' => 'datetime',
            'read_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Notification $notification): void {
            $notification->id ??= (string) Str::uuid();
        });
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }
}
