<?php
// [FEATURE: User Management] - manages user profiles, accounts, and directory access.

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Profile extends Model
{
    use HasUuids;

    public const ROLE_DEPARTMENT_STAFF = 'department_staff';
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

    // Casts profile state values to their native types.
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    // Returns the department associated with the profile.
    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    // Returns documents originally submitted by this profile.
    public function submittedDocuments(): HasMany
    {
        return $this->hasMany(Document::class, 'submitted_by');
    }

    // Returns documents assigned to this profile for legal review.
    public function assignedDocuments(): HasMany
    {
        return $this->hasMany(Document::class, 'assigned_legal_counsel');
    }

    // Returns notifications addressed to this profile.
    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class, 'user_id');
    }

    // Returns document messages sent by this profile.
    public function documentMessages(): HasMany
    {
        return $this->hasMany(DocumentMessage::class, 'sender_id');
    }

    // Exposes uploaded files so hard deletion can reject accounts with document history.
    public function documentFiles(): HasMany
    {
        return $this->hasMany(DocumentFile::class, 'uploaded_by');
    }
}
