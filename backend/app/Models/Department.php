<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Department extends Model
{
    protected $table = 'departments';

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;
}
