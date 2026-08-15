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
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('api', function (Request $request) {
            $profile = $request->attributes->get(
                'authenticated_profile'
            );

            return Limit::perMinute(120)->by(
                $profile?->id ?: $request->ip()
            );
        });

        Gate::define(
            'view-document-metadata',
            function (
                Profile $profile,
                Document $document
            ): bool {
                // A selected partner is not yet a recipient.  Keep all
                // document and annotation data private until it is routed.
                if (
                    $profile->role === Profile::ROLE_DEPARTMENT_STAFF &&
                    $profile->department_id === $document->partner_department_id &&
                    !$document->department_review_routed_at
                ) {
                    return false;
                }

                if (
                    $document->partner_department_id &&
                    $document->status === Document::STATUS_DEPARTMENT_REVIEW
                ) {
                    return $profile->role === Profile::ROLE_DEPARTMENT_STAFF &&
                        in_array($profile->department_id, [
                            $document->department_id,
                            $document->partner_department_id,
                        ], true);
                }

                if (
                    in_array($profile->role, [
                        Profile::ROLE_IRO_ADMIN,
                    ], true)
                ) {
                    return true;
                }

                if (
                    $profile->role ===
                    Profile::ROLE_LEGAL_COUNSEL
                ) {
                    return $document
                        ->assigned_legal_counsel === $profile->id;
                }

                if (
                    $profile->role ===
                    Profile::ROLE_DEPARTMENT_STAFF
                ) {
                    return in_array($profile->department_id, [
                        $document->department_id,
                        $document->partner_department_id,
                    ], true);
                }

                return false;
            }
        );
    }
}
