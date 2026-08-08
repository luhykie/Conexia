<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DepartmentController;
use App\Http\Controllers\Api\DepartmentDocumentController;
use App\Http\Controllers\Api\DocumentFileController;
use App\Http\Controllers\Api\DocumentReviewController;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\IroDocumentController;
use App\Http\Controllers\Api\LegalCounselController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\SubmissionController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\WorkflowSummaryController;
use App\Http\Middleware\AuthenticateSupabaseUser;
use App\Http\Middleware\EnsureRole;
use App\Http\Middleware\EnsureUserDirectoryAccess;
use App\Http\Middleware\EnsureUserManagementAccess;
use App\Models\Profile;
use Illuminate\Support\Facades\Route;

Route::get('/health', [HealthController::class, 'show']);
Route::post('/login', [AuthController::class, 'login']);

Route::middleware('supabase.jwt')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::get('/department/documents', [DepartmentDocumentController::class, 'index']);
    Route::get('/department/documents/{id}', [DepartmentDocumentController::class, 'show']);
    Route::post('/department/documents', [DepartmentDocumentController::class, 'store']);
    Route::patch('/department/documents/{id}', [DepartmentDocumentController::class, 'update']);
    Route::patch('/department/documents/{id}/resubmit', [DepartmentDocumentController::class, 'resubmit']);
    Route::get('/iro/documents/incoming', [IroDocumentController::class, 'incoming']);
    Route::get('/iro/documents/status', [IroDocumentController::class, 'status']);
    Route::patch('/iro/documents/{id}/log', [IroDocumentController::class, 'markLogged']);
    Route::patch('/iro/documents/{id}/assign-legal', [IroDocumentController::class, 'assignLegal']);
    Route::patch('/iro/documents/{id}/archive', [IroDocumentController::class, 'archive']);
    Route::get('/submissions', [SubmissionController::class, 'index']);
    Route::post('/submissions', [SubmissionController::class, 'store']);
    Route::get('/submissions/{submissionId}', [SubmissionController::class, 'show']);
    Route::patch('/submissions/{submissionId}', [SubmissionController::class, 'update']);
    Route::delete('/submissions/{submissionId}', [SubmissionController::class, 'destroy']);
    Route::get('/submissions/{submissionId}/file', [SubmissionController::class, 'downloadFile']);
    Route::get('/submissions/{submissionId}/document', [SubmissionController::class, 'downloadDocument']);
    Route::get('/submissions/{submissionId}/file/download', [SubmissionController::class, 'downloadFileRaw'])->name('submissions.file.download');
    Route::post('/submissions/{submissionId}/attachment', [SubmissionController::class, 'uploadAttachment']);
    Route::patch('/submissions/{submissionId}/status', [SubmissionController::class, 'updateStatus']);
    Route::post('/submissions/{submissionId}/review-form', [SubmissionController::class, 'generateReviewForm']);
    Route::post('/submissions/{submissionId}/notarization-form', [SubmissionController::class, 'generateNotarizationForm']);
    Route::post('/submissions/{submissionId}/notarization', [SubmissionController::class, 'recordNotarization']);
    Route::post('/submissions/{submissionId}/archive', [SubmissionController::class, 'archiveSubmission']);
    Route::post('/submissions/{submissionId}/distribute', [SubmissionController::class, 'distributeSubmission']);
    Route::get('/submissions/{submissionId}/review', [DocumentReviewController::class, 'index']);
    Route::post('/submissions/{submissionId}/review/comments', [DocumentReviewController::class, 'storeComment']);
    Route::patch('/submissions/{submissionId}/review/comments/{commentId}', [DocumentReviewController::class, 'updateComment']);
    Route::delete('/submissions/{submissionId}/review/comments/{commentId}', [DocumentReviewController::class, 'destroyComment']);
    Route::post('/submissions/{submissionId}/review/annotations', [DocumentReviewController::class, 'storeAnnotation']);
    Route::patch('/submissions/{submissionId}/review/annotations/{annotationId}', [DocumentReviewController::class, 'updateAnnotation']);
    Route::delete('/submissions/{submissionId}/review/annotations/{annotationId}', [DocumentReviewController::class, 'destroyAnnotation']);
});

Route::middleware(['throttle:api', AuthenticateSupabaseUser::class])->group(function (): void {
    Route::get('/me', [AuthController::class, 'me']);
});

Route::middleware([
    'throttle:api',
    AuthenticateSupabaseUser::class,
    EnsureRole::class.':'.Profile::ROLE_DEPARTMENT_STAFF,
])->get('/department/dashboard', [DashboardController::class, 'department']);

Route::middleware([
    'throttle:api',
    AuthenticateSupabaseUser::class,
    EnsureRole::class.':'.Profile::ROLE_IRO_STAFF.','.Profile::ROLE_IRO_ADMIN,
])->get('/iro/dashboard', [DashboardController::class, 'iro']);

Route::middleware([
    'throttle:api',
    AuthenticateSupabaseUser::class,
    EnsureRole::class.':'.Profile::ROLE_SUPER_ADMIN,
])->get('/super-admin/dashboard', [DashboardController::class, 'superAdmin']);

Route::middleware([
    'throttle:api',
    AuthenticateSupabaseUser::class,
    EnsureRole::class.':'.Profile::ROLE_LEGAL_COUNSEL,
])->prefix('legal')->group(function (): void {
    Route::get('/dashboard', [DashboardController::class, 'legal']);
    Route::get('/documents/review', [LegalCounselController::class, 'reviewDocuments']);
    Route::patch('/documents/{id}/decision', [LegalCounselController::class, 'submitDecision']);
    Route::get('/documents/notarization', [LegalCounselController::class, 'notarizationDocuments']);
    Route::patch('/documents/{id}/submit-notarization', [LegalCounselController::class, 'submitForNotarization']);
    Route::patch('/documents/{id}/complete-notarization', [LegalCounselController::class, 'completeNotarization']);
    Route::patch('/documents/{id}/notarization/submit', [LegalCounselController::class, 'submitForNotarization']);
    Route::patch('/documents/{id}/notarization/complete', [LegalCounselController::class, 'completeNotarization']);
    Route::get('/history', [LegalCounselController::class, 'history']);
});

Route::middleware(['throttle:api', AuthenticateSupabaseUser::class])->group(function () {
    Route::middleware(EnsureUserDirectoryAccess::class)->group(function (): void {
        Route::get('/users', [UserController::class, 'index']);
    });

    Route::middleware([
        EnsureRole::class.':'.Profile::ROLE_SUPER_ADMIN.','.Profile::ROLE_IRO_ADMIN,
        EnsureUserManagementAccess::class,
    ])->group(function (): void {
        Route::get('/users/{profile}', [UserController::class, 'show']);
        Route::patch('/users/{profile}/status', [UserController::class, 'updateStatus']);
        Route::patch('/users/{profile}/assignment', [UserController::class, 'updateAssignment']);
    });

    Route::middleware([
        EnsureRole::class.':'.Profile::ROLE_SUPER_ADMIN.','.Profile::ROLE_IRO_ADMIN.','.Profile::ROLE_IRO_STAFF,
    ])->group(function (): void {
        Route::get('/departments', [DepartmentController::class, 'index']);
        Route::get('/departments/{department}', [DepartmentController::class, 'show']);
    });

    Route::middleware([
        EnsureRole::class.':'.Profile::ROLE_DEPARTMENT_STAFF.','.Profile::ROLE_IRO_STAFF.','.Profile::ROLE_IRO_ADMIN.','.Profile::ROLE_LEGAL_COUNSEL,
    ])->group(function (): void {
        Route::get('/expiry', [WorkflowSummaryController::class, 'expiry']);
        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::post('/notifications', [NotificationController::class, 'store']);
        Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
        Route::patch('/notifications/read-all', [NotificationController::class, 'markAllRead']);
        Route::patch('/notifications/{id}/read', [NotificationController::class, 'markRead']);
    });

    Route::middleware([
        EnsureRole::class.':'.Profile::ROLE_DEPARTMENT_STAFF.','.Profile::ROLE_IRO_ADMIN.','.Profile::ROLE_LEGAL_COUNSEL,
    ])->group(function (): void {
        Route::patch('/expiry/documents/{id}/renewal-request', [WorkflowSummaryController::class, 'requestRenewal']);
        Route::get('/documents/{document}/files', [DocumentFileController::class, 'metadata']);
        Route::post('/documents/{document}/files', [DocumentFileController::class, 'upload']);
        Route::get('/documents/{document}/files/{file}/download', [DocumentFileController::class, 'download']);
        Route::get('/documents/{document}/files/{file}/preview', [DocumentFileController::class, 'preview']);
        Route::delete('/documents/{document}/files/{file}', [DocumentFileController::class, 'delete']);
    });

    Route::middleware([
        EnsureRole::class.':'.Profile::ROLE_IRO_ADMIN,
    ])->group(function (): void {
        Route::get('/iro/archive', [WorkflowSummaryController::class, 'archive']);
        Route::get('/iro/reports', [WorkflowSummaryController::class, 'reports']);
    });
});
