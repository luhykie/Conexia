<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RolePermission extends Model
{
    protected $primaryKey = 'role';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'role',
        'permissions',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'permissions' => 'array',
        ];
    }
}
