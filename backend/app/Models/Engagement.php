<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Str;

class Engagement extends Model
{
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'client_submission_id',
        'document_id', 'engagement_type', 'partner_classification',
        'partner_name', 'partner_email', 'partner_contact', 'partner_address',
        'agreement_title', 'agreement_summary', 'effective_date', 'expiry_date',
        'lifecycle_status', 'created_by',
    ];

    protected function casts(): array
    {
        return ['effective_date' => 'date', 'expiry_date' => 'date'];
    }

    protected static function booted(): void
    {
        static::creating(function (Engagement $engagement): void {
            $engagement->id ??= (string) Str::uuid();
        });
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    public function departments(): BelongsToMany
    {
        return $this->belongsToMany(Department::class, 'engagement_department');
    }

    public function distributionRecipients(): BelongsToMany
    {
        return $this->belongsToMany(DistributionRecipient::class, 'engagement_distribution_recipient');
    }
}
