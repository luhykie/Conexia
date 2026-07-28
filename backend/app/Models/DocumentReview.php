<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class DocumentReview extends Model
{
    use HasUuids;

    public $incrementing = false;
    protected $keyType = 'string';
    protected $table = 'document_reviews';
    protected $fillable = ['submission_id', 'reviewer_id', 'role_key', 'decision', 'comments', 'status_before', 'status_after', 'metadata'];
    protected function casts(): array { return ['metadata' => 'array', 'created_at' => 'datetime']; }
}
