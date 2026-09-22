<?php
// [FEATURE: Role Management] - configures application roles and role permissions.

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

    // Casts the permission flag to a native boolean value.
    protected function casts(): array
    {
        return [
            'permissions' => 'array',
        ];
    }
}
