<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class DistributionRecipient extends Model
{
    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'document_type',
        'recipient_name',
        'recipient_email',
        'organization',
        'role_scope',
        'access_level',
        'is_active',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (DistributionRecipient $recipient): void {
            $recipient->id ??= (string) Str::uuid();
        });
    }
}
