<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class DocumentStatusHistory extends Model
{
    use HasUuids;
    public $incrementing = false;
    protected $keyType = 'string';
    protected $table = 'document_status_history';
    protected $fillable = ['submission_id', 'status_before', 'status_after', 'changed_by', 'comments'];
    public $timestamps = false;
    protected function casts(): array { return ['created_at' => 'datetime']; }
}
