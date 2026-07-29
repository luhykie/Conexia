<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class ReviewForm extends Model
{
    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'document_id',
        'checklist_answers',
        'staff_remarks',
        'review_form_status',
        'prepared_by',
        'submitted_at',
        'admin_remarks',
        'validated_by',
        'validated_at',
        'sent_back_reason',
        'sent_back_by',
        'sent_back_at',
    ];

    protected function casts(): array
    {
        return [
            'checklist_answers' => 'array',
            'submitted_at' => 'datetime',
            'validated_at' => 'datetime',
            'sent_back_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (ReviewForm $form): void {
            $form->id ??= (string) Str::uuid();
        });
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    public function preparer(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'prepared_by');
    }

    public function validator(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'validated_by');
    }

    public function sentBackBy(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'sent_back_by');
    }
}
