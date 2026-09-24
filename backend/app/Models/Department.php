<?php
// Department model: i-expose ang related profiles ug docs para sa department-scoped access.

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Department extends Model
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';

    public $timestamps = false;

    protected $fillable = [
        'name',
        'code',
        'email',
        'office_assignment',
        'is_active',
    ];

    // Casts the editable directory status to a boolean for the API and Super Admin form.
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    // I-expose ang related profiles nga sakop ni nga department.
    public function profiles(): HasMany
    {
        return $this->hasMany(Profile::class);
    }

    // I-expose ang related documents nga sakop ni nga department.
    public function documents(): HasMany
    {
        return $this->hasMany(Document::class);
    }
}
