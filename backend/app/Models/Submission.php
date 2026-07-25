<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Submission extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $table = 'submissions';

    protected $fillable = [
        'tracking_number',
        'submitted_by',
        'office',
        'department',
        'contact_person',
        'contact_position',
        'contact_email',
        'contact_number',
        'partner_institution_name',
        'agreement_type',
        'agreement_title',
        'expected_duration',
        'partner_contact_email',
        'requested_completion_date',
        'urgency_level',
        'requested_by_name',
        'requested_by_date',
        'noted_by_name',
        'noted_by_date',
        'storage_path',
        'file_name',
        'status',
        'date_received',
        'received_by',
        'pair_remarks',
        'date_completed',
        'pair_review_status',
        'signing_date',
        'signing_mode',
        'copies_for_notarization',
        'notarial_reference',
        'notarial_date',
        'legal_comments',
        'legal_reviewed_by',
        'legal_reviewed_at',
        'review_form_generated_at',
        'notarization_form_generated_at',
    ];

    protected function casts(): array
    {
        return [
            'requested_completion_date' => 'date',
            'requested_by_date' => 'date',
            'noted_by_date' => 'date',
            'signing_date' => 'date',
            'notarial_date' => 'date',
            'date_received' => 'datetime',
            'date_completed' => 'datetime',
            'legal_reviewed_at' => 'datetime',
            'review_form_generated_at' => 'datetime',
            'notarization_form_generated_at' => 'datetime',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    public function submitter(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'submitted_by');
    }

    public function versions(): HasMany
    {
        return $this->hasMany(SubmissionVersion::class);
    }

    public function workflowEvents(): HasMany
    {
        return $this->hasMany(WorkflowEvent::class);
    }
}
