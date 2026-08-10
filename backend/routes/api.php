<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DepartmentDocumentController;
use App\Http\Controllers\Api\DocumentFileController;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\IroDocumentController;
use App\Http\Controllers\Api\LegalCounselController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\RoleSettingsController;
use App\Http\Controllers\Api\WorkflowSummaryController;
use App\Http\Middleware\AuthenticateSupabaseUser;
use App\Http\Middleware\EnsureRole;
use App\Http\Middleware\EnsureUserDirectoryAccess;
use App\Http\Middleware\EnsureUserManagementAccess;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\DepartmentController;
use App\Http\Controllers\Api\UserController;
use App\Models\Profile;

Route::middleware(['throttle:api', AuthenticateSupabaseUser::class])
    ->group(function (): void {
        Route::get('/health', HealthController::class);

        Route::get('/me', [AuthController::class, 'me']);
    });

Route::middleware([
    'throttle:api',
    AuthenticateSupabaseUser::class,
    EnsureRole::class.':'.Profile::ROLE_DEPARTMENT_STAFF,
])
    ->get(
        '/department/dashboard',
        [DashboardController::class, 'department']
    );

Route::middleware([
    'throttle:api',
    AuthenticateSupabaseUser::class,
    EnsureRole::class
        .':'
        .Profile::ROLE_IRO_STAFF
        .','
        .Profile::ROLE_IRO_ADMIN,
])
    ->get('/iro/dashboard', [DashboardController::class, 'iro']);

Route::middleware([
    'throttle:api',
    AuthenticateSupabaseUser::class,
    EnsureRole::class.':'.Profile::ROLE_SUPER_ADMIN,
])
    ->get(
        '/super-admin/dashboard',
        [DashboardController::class, 'superAdmin']
    );

Route::middleware([
    'throttle:api',
    AuthenticateSupabaseUser::class,
    EnsureRole::class.':'.Profile::ROLE_LEGAL_COUNSEL,
])
    ->prefix('legal')
    ->group(function (): void {
        Route::get(
            '/dashboard',
            [DashboardController::class, 'legal']
        );

        Route::get(
            '/documents/review',
            [LegalCounselController::class, 'reviewDocuments']
        );

        Route::patch(
            '/documents/{id}/decision',
            [LegalCounselController::class, 'submitDecision']
        );

        Route::get(
            '/documents/notarization',
            [LegalCounselController::class, 'notarizationDocuments']
        );

        Route::patch(
            '/documents/{id}/submit-notarization',
            [LegalCounselController::class, 'submitForNotarization']
        );

        Route::patch(
            '/documents/{id}/complete-notarization',
            [LegalCounselController::class, 'completeNotarization']
        );

        Route::patch(
            '/documents/{id}/notarization/submit',
            [LegalCounselController::class, 'submitForNotarization']
        );

        Route::patch(
            '/documents/{id}/notarization/complete',
            [LegalCounselController::class, 'completeNotarization']
        );

        Route::get(
            '/history',
            [LegalCounselController::class, 'history']
        );
    });

Route::middleware(['throttle:api', AuthenticateSupabaseUser::class])
    ->group(function () {
        Route::middleware(
            EnsureUserDirectoryAccess::class
        )
            ->group(function (): void {
                Route::get(
                    '/users',
                    [UserController::class, 'index']
                );
            });

        Route::middleware(
            EnsureRole::class.':'.Profile::ROLE_SUPER_ADMIN
        )
            ->group(function (): void {
                Route::post(
                    '/users',
                    [UserController::class, 'store']
                );

                Route::post(
                    '/departments',
                    [DepartmentController::class, 'store']
                );

                Route::get(
                    '/super-admin/roles',
                    [RoleSettingsController::class, 'index']
                );

                Route::patch(
                    '/super-admin/roles',
                    [RoleSettingsController::class, 'update']
                );

                Route::get(
                    '/super-admin/audit-logs',
                    [AuditLogController::class, 'index']
                );

                Route::get(
                    '/super-admin/audit-logs/export',
                    [AuditLogController::class, 'export']
                );
            });

        Route::middleware([
            EnsureRole::class
                .':'
                .Profile::ROLE_SUPER_ADMIN
                .','
                .Profile::ROLE_IRO_ADMIN,
            EnsureUserManagementAccess::class,
        ])
            ->group(function (): void {
                Route::get(
                    '/users/{profile}',
                    [UserController::class, 'show']
                );

                Route::patch(
                    '/users/{profile}/status',
                    [UserController::class, 'updateStatus']
                );

                Route::patch(
                    '/users/{profile}/assignment',
                    [UserController::class, 'updateAssignment']
                );
            });

        Route::middleware(
            EnsureRole::class
                .':'
                .Profile::ROLE_SUPER_ADMIN
                .','
                .Profile::ROLE_IRO_ADMIN
                .','
                .Profile::ROLE_IRO_STAFF
                .','
                .Profile::ROLE_DEPARTMENT_STAFF
        )
            ->group(function (): void {
                Route::get(
                    '/departments',
                    [DepartmentController::class, 'index']
                );

                Route::get(
                    '/departments/{department}',
                    [DepartmentController::class, 'show']
                );
            });

        Route::middleware(
            EnsureRole::class
                .':'
                .Profile::ROLE_DEPARTMENT_STAFF
                .','
                .Profile::ROLE_IRO_STAFF
                .','
                .Profile::ROLE_IRO_ADMIN
                .','
                .Profile::ROLE_LEGAL_COUNSEL
        )
            ->group(function (): void {
                Route::get(
                    '/expiry',
                    [WorkflowSummaryController::class, 'expiry']
                );

                Route::get(
                    '/notifications',
                    [NotificationController::class, 'index']
                );

                Route::post(
                    '/notifications',
                    [NotificationController::class, 'store']
                );

                Route::get(
                    '/notifications/unread-count',
                    [NotificationController::class, 'unreadCount']
                );

                Route::patch(
                    '/notifications/read-all',
                    [NotificationController::class, 'markAllRead']
                );

                Route::patch(
                    '/notifications/{id}/read',
                    [NotificationController::class, 'markRead']
                );
            });

        Route::middleware(
            EnsureRole::class
                .':'
                .Profile::ROLE_DEPARTMENT_STAFF
                .','
                .Profile::ROLE_IRO_ADMIN
                .','
                .Profile::ROLE_LEGAL_COUNSEL
        )
            ->group(function (): void {
                Route::patch(
                    '/expiry/documents/{id}/renewal-request',
                    [
                        WorkflowSummaryController::class,
                        'requestRenewal',
                    ]
                );

                Route::get(
                    '/documents/{document}/files',
                    [DocumentFileController::class, 'metadata']
                );

                Route::post(
                    '/documents/{document}/files',
                    [DocumentFileController::class, 'upload']
                );

                Route::get(
                    '/documents/{document}/files/{file}/download',
                    [DocumentFileController::class, 'download']
                );

                Route::get(
                    '/documents/{document}/files/{file}/preview',
                    [DocumentFileController::class, 'preview']
                );

                Route::delete(
                    '/documents/{document}/files/{file}',
                    [DocumentFileController::class, 'delete']
                );
            });

        Route::middleware(
            EnsureRole::class
                .':'
                .Profile::ROLE_DEPARTMENT_STAFF
        )
            ->group(function (): void {
                Route::get(
                    '/department/documents',
                    [DepartmentDocumentController::class, 'index']
                );

                Route::post(
                    '/department/documents',
                    [DepartmentDocumentController::class, 'store']
                );

                Route::patch(
                    '/department/documents/{id}/resubmit',
                    [DepartmentDocumentController::class, 'resubmit']
                );
            });

        Route::middleware(
            EnsureRole::class
                .':'
                .Profile::ROLE_IRO_STAFF
                .','
                .Profile::ROLE_IRO_ADMIN
        )
            ->group(function (): void {
                Route::get(
                    '/iro/documents/incoming',
                    [IroDocumentController::class, 'incoming']
                );

                Route::get(
                    '/iro/documents/status',
                    [IroDocumentController::class, 'status']
                );
            });

        Route::middleware(
            EnsureRole::class.':'.Profile::ROLE_IRO_ADMIN
        )
            ->group(function (): void {
Route::post(
            '/iro/documents',
            [IroDocumentController::class, 'store']
        );

Route::post(
            '/iro/documents',
            [IroDocumentController::class, 'store']
        );

        Route::patch(
                    '/iro/documents/{id}/log',
                    [IroDocumentController::class, 'markLogged']
                );

                Route::patch(
                    '/iro/documents/{id}/assign-legal',
                    [IroDocumentController::class, 'assignLegal']
                );

                Route::patch(
                    '/iro/documents/{id}/reassign-legal',
                    [IroDocumentController::class, 'reassignLegal']
                );

                Route::patch(
                    '/iro/documents/{id}/archive',
                    [IroDocumentController::class, 'archive']
                );

                Route::patch(
                    '/iro/documents/{id}/unarchive',
                    [IroDocumentController::class, 'unarchive']
                );
            });

        Route::middleware(
            EnsureRole::class.':'.Profile::ROLE_IRO_ADMIN
        )
            ->group(function (): void {
                Route::get(
                    '/iro/archive',
                    [WorkflowSummaryController::class, 'archive']
                );

                Route::get(
                    '/iro/reports',
                    [WorkflowSummaryController::class, 'reports']
                );
            });
    });
