<?php
// [FEATURE: Department Management] - manages departments and department-scoped workflow data.

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
    ];

    // Renders the page for the department management and department-scoped workflow.
    public function profiles(): HasMany
    {
        return $this->hasMany(Profile::class);
    }

    // Renders the page for the department management and department-scoped workflow.
    public function documents(): HasMany
    {
        return $this->hasMany(Document::class);
    }
}
