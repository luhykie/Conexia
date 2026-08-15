<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentDiscussionMessage extends Model
{
    use HasUuids;
    protected $fillable = ['document_id', 'review_version', 'department_id', 'author_id', 'message'];
    public function department(): BelongsTo { return $this->belongsTo(Department::class); }
    public function author(): BelongsTo { return $this->belongsTo(Profile::class, 'author_id'); }
}
