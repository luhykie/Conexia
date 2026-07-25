<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Document extends Model
{
    use HasUuids;

    public const STATUS_SUBMITTED = 'Submitted';
    public const STATUS_LOGGED = 'Logged';
    public const STATUS_UNDER_LEGAL_REVIEW = 'Under Legal Review';
    public const STATUS_CORRECTIONS_NEEDED = 'Corrections Needed';
    public const STATUS_APPROVED = 'Approved';
    public const STATUS_PENDING_NOTARIZATION = 'Pending Notarization';
    public const STATUS_NOTARIZED = 'Notarized';
    public const STATUS_ARCHIVED = 'Archived';

    public $incrementing = false;

    protected $keyType = 'string';

    public const CREATED_AT = 'submitted_at';

    public const UPDATED_AT = 'updated_at';

    protected $fillable = [
        'tracking_number',
        'title',
        'document_type',
        'partner_institution',
        'partner_email',
        'description',
        'department_id',
        'submitted_by',
        'assigned_legal_counsel',
        'status',
        'legal_notes',
        'notarial_reference_number',
        'notarization_date',
        'notary_signature_code',
        'archived_at',
        'archived_by',
    ];

    protected function casts(): array
    {
        return [
            'submitted_at' => 'datetime',
            'updated_at' => 'datetime',
            'notarization_date' => 'date',
            'archived_at' => 'datetime',
        ];
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function submitter(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'submitted_by');
    }

    public function legalCounsel(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'assigned_legal_counsel');
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class);
    }
}
