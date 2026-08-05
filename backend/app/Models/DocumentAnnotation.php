<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class DocumentAnnotation extends Model
{
    use HasUuids;

    public $incrementing = false;
    protected $keyType = 'string';
    protected $table = 'document_annotations';
    protected $fillable = [
        'submission_id',
        'document_version_id',
        'page_number',
        'highlight_coordinates',
        'color',
        'created_by',
        'created_by_name',
        'role',
    ];

    protected function casts(): array
    {
        return [
            'highlight_coordinates' => 'array',
        ];
    }
}
