<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Profile extends Model
{
    use HasUuids;

    public const ROLE_DEPARTMENT_STAFF = 'department_staff';
    public const ROLE_IRO_STAFF = 'iro_staff';
    public const ROLE_IRO_ADMIN = 'iro_admin';
    public const ROLE_LEGAL_COUNSEL = 'legal_counsel';
    public const ROLE_SUPER_ADMIN = 'super_admin';

    public $incrementing = false;

    protected $keyType = 'string';

    public $timestamps = false;

    protected $fillable = [
        'full_name',
        'email',
        'role',
        'department_id',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function submittedDocuments(): HasMany
    {
        return $this->hasMany(Document::class, 'submitted_by');
    }

    public function assignedDocuments(): HasMany
    {
        return $this->hasMany(Document::class, 'assigned_legal_counsel');
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class, 'user_id');
    }
}
