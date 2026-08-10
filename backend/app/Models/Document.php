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

    public const RENEWAL_NOT_REQUIRED = 'not_required';
    public const RENEWAL_ACTIVE = 'active';
    public const RENEWAL_DUE = 'renewal_due';
    public const RENEWAL_REQUESTED = 'renewal_requested';
    public const RENEWAL_RENEWED = 'renewed';
    public const RENEWAL_EXPIRED = 'expired';

    public const DEFAULT_RENEWAL_NOTICE_DAYS = 30;

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
        'effective_date',
        'expiry_date',
        'renewal_notice_days',
        'renewal_status',
        'partnership_type',
        'partnership_scope',
        'contact_person',
        'contact_position',
        'contact_email',
        'contact_number',
        'urgency',
        'requested_completion_date',
    ];

    protected function casts(): array
    {
        return [
            'submitted_at' => 'datetime',
            'updated_at' => 'datetime',
            'notarization_date' => 'date',
            'archived_at' => 'datetime',
            'effective_date' => 'date',
            'expiry_date' => 'date',
            'requested_completion_date' => 'date',
            'renewal_notice_days' => 'integer',
        ];
    }

    public static function renewalStatuses(): array
    {
        return [
            self::RENEWAL_NOT_REQUIRED,
            self::RENEWAL_ACTIVE,
            self::RENEWAL_DUE,
            self::RENEWAL_REQUESTED,
            self::RENEWAL_RENEWED,
            self::RENEWAL_EXPIRED,
        ];
    }

    public static function workflowStatuses(): array
    {
        return [
            self::STATUS_SUBMITTED,
            self::STATUS_LOGGED,
            self::STATUS_UNDER_LEGAL_REVIEW,
            self::STATUS_CORRECTIONS_NEEDED,
            self::STATUS_APPROVED,
            self::STATUS_PENDING_NOTARIZATION,
            self::STATUS_NOTARIZED,
            self::STATUS_ARCHIVED,
        ];
    }

    public function scopeExpiringSoon($query, ?int $days = null)
    {
        $window = $days ?? self::DEFAULT_RENEWAL_NOTICE_DAYS;

        return $query
            ->whereNotNull('expiry_date')
            ->whereDate('expiry_date', '>=', now()->toDateString())
            ->whereDate(
                'expiry_date',
                '<=',
                now()->addDays($window)->toDateString()
            );
    }

    public function scopeExpired($query)
    {
        return $query
            ->whereNotNull('expiry_date')
            ->whereDate('expiry_date', '<', now()->toDateString());
    }

    public function scopeRenewalRequired($query)
    {
        return $query->whereIn('renewal_status', [
            self::RENEWAL_DUE,
            self::RENEWAL_REQUESTED,
            self::RENEWAL_EXPIRED,
        ]);
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

    public function files(): HasMany
    {
        return $this->hasMany(DocumentFile::class);
    }
}
