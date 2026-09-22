<?php
// [FEATURE: IRO Admin Workflow] - supports document intake, file handling, and administrative workflow processing.

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Document extends Model
{
    use HasUuids;

    public const STATUS_SUBMITTED = 'Submitted';
    public const STATUS_DEPARTMENT_REVIEW = 'Department Review';
    public const STATUS_PARTNER_REVIEW_COMPLETE = 'Partner Review Complete';
    public const STATUS_LOGGED = 'Logged';
    public const STATUS_UNDER_LEGAL_REVIEW = 'Under Legal Review';
    public const STATUS_CORRECTION_REQUIRED = 'Correction Required';
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
        'partner_department_id',
        'department_review_version',
        'department_review_routed_at',
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

    // Casts document dates and workflow values to their native types.
    protected function casts(): array
    {
        return [
            'submitted_at' => 'datetime',
            'department_review_routed_at' => 'datetime',
            'updated_at' => 'datetime',
            'notarization_date' => 'date',
            'archived_at' => 'datetime',
            'effective_date' => 'date',
            'expiry_date' => 'date',
            'requested_completion_date' => 'date',
            'renewal_notice_days' => 'integer',
        ];
    }

    // Lists every supported agreement renewal state.
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

    // Lists every supported document workflow state.
    public static function workflowStatuses(): array
    {
        return [
            self::STATUS_SUBMITTED,
            self::STATUS_DEPARTMENT_REVIEW,
            self::STATUS_PARTNER_REVIEW_COMPLETE,
            self::STATUS_LOGGED,
            self::STATUS_UNDER_LEGAL_REVIEW,
            self::STATUS_CORRECTION_REQUIRED,
            self::STATUS_CORRECTIONS_NEEDED,
            self::STATUS_APPROVED,
            self::STATUS_PENDING_NOTARIZATION,
            self::STATUS_NOTARIZED,
            self::STATUS_ARCHIVED,
        ];
    }

    // Limits the query to agreements approaching their expiry date.
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

    // Limits the query to agreements whose expiry date has passed.
    public function scopeExpired($query)
    {
        return $query
            ->whereNotNull('expiry_date')
            ->whereDate('expiry_date', '<', now()->toDateString());
    }

    // Limits the query to agreements that require renewal action.
    public function scopeRenewalRequired($query)
    {
        return $query->whereIn('renewal_status', [
            self::RENEWAL_DUE,
            self::RENEWAL_REQUESTED,
            self::RENEWAL_EXPIRED,
        ]);
    }

    // Returns the department that owns the document.
    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    // Returns the partner department assigned to review the document.
    public function partnerDepartment(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'partner_department_id');
    }

    // Returns the department review cycles recorded for the document.
    public function departmentReviews(): HasMany
    {
        return $this->hasMany(DocumentDepartmentReview::class);
    }

    // Returns the review annotations and comments for the document.
    public function reviewItems(): HasMany
    {
        return $this->hasMany(DocumentReviewItem::class);
    }

    // Returns the profile that originally submitted the document.
    public function submitter(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'submitted_by');
    }

    // Returns the Legal Counsel currently assigned to the document.
    public function legalCounsel(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'assigned_legal_counsel');
    }

    // Returns the most recent reassignment recorded by IRO Admin.
    public function latestReassignment(): HasOne
    {
        return $this->hasOne(AuditLog::class)
            ->where('action', 'iro_admin.document.reassigned')
            ->latest('created_at');
    }

    // Returns notifications associated with the document.
    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class);
    }

    // Returns the document's complete audit history.
    public function auditLogs(): HasMany
    {
        return $this->hasMany(AuditLog::class);
    }

    // Returns the most recent correction request from Legal Counsel.
    public function latestLegalCorrection(): HasOne
    {
        return $this->hasOne(AuditLog::class)
            ->where('action', 'legal.review.correction_requested')
            ->latest('created_at');
    }

    // Returns every uploaded version belonging to the document.
    public function files(): HasMany
    {
        return $this->hasMany(DocumentFile::class);
    }

    // Returns messages exchanged by the document participants.
    public function messages(): HasMany
    {
        return $this->hasMany(DocumentMessage::class);
    }
}
