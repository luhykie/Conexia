<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class DocumentLog extends Model
{
    use HasUuids;
    public $incrementing = false;
    protected $keyType = 'string';
    protected $table = 'document_logs';
    protected $fillable = ['submission_id', 'user_id', 'role_key', 'action', 'comments'];
    public $timestamps = false;
    protected function casts(): array { return ['created_at' => 'datetime']; }
}
