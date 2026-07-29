<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Profile extends Model
{
    protected $table = 'profiles';

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;
}
