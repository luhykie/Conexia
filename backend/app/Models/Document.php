<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Document extends Model
{
    protected $table = 'documents';

    protected $primaryKey = 'id';

    public $incrementing = false;

    protected $keyType = 'string';

    public $timestamps = false;

    protected $fillable = [
        'tracking_number',
        'title',
        'document_type',
        'partner_institution',
        'partner_email',
        'description',
        'department_id',
        'submitted_by',
        'assigned_iro_staff',
        'assigned_legal_counsel',
        'status',
        'legal_notes',
        'submitted_at',
        'updated_at',
        'notarial_reference_number',
        'notarization_date',
        'notary_signature_code',
        'archived_at',
        'archived_by',
        'signed_document_summary',
        'summary_extracted_at',
        'effective_date',
        'expiry_date',
    ];

    protected function casts(): array
    {
        return [
            'submitted_at' => 'datetime',
            'updated_at' => 'datetime',
            'notarization_date' => 'date',
            'archived_at' => 'datetime',
            'summary_extracted_at' => 'datetime',
            'effective_date' => 'date',
            'expiry_date' => 'date',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Document $document): void {
            if (! $document->id) {
                $document->id = (string) Str::uuid();
            }
        });
    }

    public function departments(): BelongsTo
    {
        return $this->belongsTo(
            Department::class,
            'department_id'
        );
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(
            Department::class,
            'department_id'
        );
    }

    public function assignedIroStaffProfile(): BelongsTo
    {
        return $this->belongsTo(
            Profile::class,
            'assigned_iro_staff'
        );
    }

    public function assignedLegalCounselProfile(): BelongsTo
    {
        return $this->belongsTo(
            Profile::class,
            'assigned_legal_counsel'
        );
    }

    public function workflowEvents(): HasMany
    {
        return $this->hasMany(WorkflowEvent::class);
    }

    public function files(): HasMany
    {
        return $this->hasMany(DocumentFile::class);
    }

    public function distributions(): HasMany
    {
        return $this->hasMany(DocumentDistribution::class);
    }

    public function reviewForm(): HasOne
    {
        return $this->hasOne(ReviewForm::class);
    }
}
