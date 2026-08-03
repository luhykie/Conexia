<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class DocumentDistribution extends Model
{
    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'document_id',
        'distribution_recipient_id',
        'recipient_name',
        'recipient_email',
        'organization',
        'role_scope',
        'access_level',
        'is_required',
        'delivery_status',
        'delivery_notes',
        'distributed_at',
        'distributed_by',
    ];

    protected function casts(): array
    {
        return [
            'is_required' => 'boolean',
            'distributed_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (DocumentDistribution $distribution): void {
            $distribution->id ??= (string) Str::uuid();
        });
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }
}
