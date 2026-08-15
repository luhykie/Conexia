<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentDepartmentReview extends Model
{
    use HasUuids;

    protected $fillable = ['document_id', 'department_id', 'version', 'approved_at', 'approved_by'];

    protected function casts(): array
    {
        return ['approved_at' => 'datetime'];
    }

    public function department(): BelongsTo { return $this->belongsTo(Department::class); }
    public function approver(): BelongsTo { return $this->belongsTo(Profile::class, 'approved_by'); }
}
