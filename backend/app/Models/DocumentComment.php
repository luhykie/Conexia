<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class DocumentComment extends Model
{
    use HasUuids;
    public $incrementing = false;
    protected $keyType = 'string';
    protected $table = 'document_comments';
    protected $fillable = ['submission_id', 'user_id', 'role_key', 'comment_type', 'comment_body'];
}
