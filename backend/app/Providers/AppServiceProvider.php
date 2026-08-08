<?php

namespace App\Providers;

use App\Models\Document;
use App\Models\Profile;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        RateLimiter::for('api', function (Request $request) {
            $profile = $request->attributes->get('authenticated_profile');

            return Limit::perMinute(120)->by($profile?->id ?: $request->ip());
        });

        Gate::define('view-document-metadata', function (Profile $profile, Document $document): bool {
            if (in_array($profile->role, [Profile::ROLE_IRO_ADMIN], true)) {
                return true;
            }

            if ($profile->role === Profile::ROLE_LEGAL_COUNSEL) {
                return $document->assigned_legal_counsel === $profile->id;
            }

            if ($profile->role === Profile::ROLE_DEPARTMENT_STAFF) {
                return $document->department_id === $profile->department_id;
            }

            return false;
        });
    }
}
