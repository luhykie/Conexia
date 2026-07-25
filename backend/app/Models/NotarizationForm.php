<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotarizationForm extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $table = 'notarization_forms';

    protected $fillable = [
        'submission_id',
        'generated_by',
        'form_data',
        'pdf_storage_path',
    ];

    protected function casts(): array
    {
        return [
            'form_data' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function submission(): BelongsTo
    {
        return $this->belongsTo(Submission::class);
    }

    public function generator(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'generated_by');
    }
}
