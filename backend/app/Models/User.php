<?php
// Model config: ipahiuyon ang Laravel auth fields ug hashed password rules.

namespace App\Models;

// Gamiton ni nga auth contract kung kinahanglan ang email verification.
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> para sa factory support ni nga model. */
    use HasFactory, Notifiable;

    // I-keep nga parehas sa Laravel defaults ang auth field casting.
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }
}
