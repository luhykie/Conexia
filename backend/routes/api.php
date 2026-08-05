<?php

use App\Http\Controllers\Api\DocumentController;
use App\Http\Controllers\Api\DistributionRecipientController;
use App\Http\Controllers\Api\EngagementController;
use App\Http\Controllers\Api\DocumentDistributionController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\IroAdminController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\ReviewFormController;
use App\Http\Controllers\Api\SubmissionRoutingController;
use App\Http\Controllers\Api\SubmissionFileController;
use App\Http\Controllers\Api\SubmissionReportController;
use Illuminate\Support\Facades\Route;

Route::middleware('supabase.auth')->group(function (): void {
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::patch('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::patch('/notifications/{notification}/read', [NotificationController::class, 'markRead']);
    Route::delete('/notifications/{notification}', [NotificationController::class, 'destroy']);

    Route::get('/iro-admin/overview', [IroAdminController::class, 'overview'])
        ->middleware('role:iro_admin');

    Route::get('/iro-admin/engagements', [EngagementController::class, 'index'])
        ->middleware('role:iro_admin');
    Route::get('/iro-admin/engagements/options', [EngagementController::class, 'options'])
        ->middleware('role:iro_admin');
    Route::post('/iro-admin/engagements', [EngagementController::class, 'store'])
        ->middleware('role:iro_admin');

    Route::get('/iro-admin/reports', [IroAdminController::class, 'reports'])
        ->middleware('role:iro_admin');

    Route::get(
        '/iro-admin/reports/review-turnaround',
        [SubmissionReportController::class, 'reviewTurnaround']
    )->middleware('role:iro_admin');

    Route::patch(
        '/iro-admin/documents/{document}/reassign',
        [IroAdminController::class, 'reassign']
    )->middleware('role:iro_admin');

    Route::patch(
        '/iro-admin/documents/{document}/assign-revision',
        [IroAdminController::class, 'assignRevision']
    )->middleware('role:iro_admin');

    Route::put(
        '/iro-staff/documents/{document}/revision-forwarding-draft',
        [DocumentController::class, 'saveRevisionForwardingDraft']
    )->middleware('role:iro_staff');

    Route::patch(
        '/iro-staff/documents/{document}/send-revision-to-department',
        [DocumentController::class, 'sendRevisionToDepartment']
    )->middleware('role:iro_staff');

    Route::patch(
        '/iro-admin/documents/{document}/archive',
        [IroAdminController::class, 'archive']
    )->middleware('role:iro_admin');

    Route::get(
        '/iro-admin/distribution-recipients',
        [DistributionRecipientController::class, 'index']
    )->middleware('role:iro_admin');

    Route::post(
        '/iro-admin/distribution-recipients',
        [DistributionRecipientController::class, 'store']
    )->middleware('role:iro_admin');

    Route::put(
        '/iro-admin/distribution-recipients/{distributionRecipient}',
        [DistributionRecipientController::class, 'update']
    )->middleware('role:iro_admin');

    Route::get(
        '/iro-admin/document-distributions',
        [DocumentDistributionController::class, 'index']
    )->middleware('role:iro_admin');

    Route::post(
        '/iro-admin/documents/{document}/distribution/prepare',
        [DocumentDistributionController::class, 'prepare']
    )->middleware('role:iro_admin');

    Route::patch(
        '/iro-admin/documents/{document}/distribution/{documentDistribution}/delivered',
        [DocumentDistributionController::class, 'markDelivered']
    )->middleware('role:iro_admin');

    Route::patch(
        '/iro-admin/documents/{document}/distribution/complete',
        [DocumentDistributionController::class, 'complete']
    )->middleware('role:iro_admin');

    Route::get('/documents', [DocumentController::class, 'index'])
        ->middleware('role:iro_staff,iro_admin,super_admin');

    Route::post('/documents', [DocumentController::class, 'store'])
        ->middleware('role:department_staff');

    Route::get('/documents/{document}', [DocumentController::class, 'show'])
        ->middleware(
            'role:department_staff,iro_staff,iro_admin,legal_counsel,super_admin'
        );

    Route::get(
        '/documents/{document}/files/{documentFile}/view',
        [DocumentController::class, 'viewFile']
    )->middleware(
        'role:department_staff,iro_staff,iro_admin,legal_counsel,super_admin'
    );

    Route::get(
        '/documents/{document}/review-form',
        [ReviewFormController::class, 'show']
    )->middleware('role:iro_staff,iro_admin,legal_counsel');

    Route::put(
        '/documents/{document}/review-form',
        [ReviewFormController::class, 'save']
    )->middleware('role:iro_staff,iro_admin');

    Route::post(
        '/documents/{document}/review-form/submit',
        [ReviewFormController::class, 'submit']
    )->middleware('role:iro_staff,iro_admin');

    Route::patch(
        '/documents/{document}/review-form/validate',
        [ReviewFormController::class, 'validateReview']
    )->middleware('role:iro_admin');

    Route::patch(
        '/documents/{document}/review-form/send-back',
        [ReviewFormController::class, 'sendBack']
    )->middleware('role:iro_admin');

    Route::get('/iro-staff/incoming', [DocumentController::class, 'incoming'])
        ->middleware('role:iro_staff,iro_admin');

    Route::get(
        '/iro-staff/dashboard',
        [DocumentController::class, 'iroStaffDashboard']
    )->middleware('role:iro_staff,iro_admin');

    Route::get(
        '/iro-staff/documents',
        [DocumentController::class, 'iroStaffDocuments']
    )->middleware('role:iro_staff');

    Route::patch('/documents/{document}/log', [DocumentController::class, 'log'])
        ->middleware('role:iro_staff,iro_admin');

    Route::post(
        '/documents/{document}/resubmit-revision',
        [DocumentController::class, 'resubmitRevision']
    )->middleware('role:department_staff');

    Route::patch(
        '/documents/{document}/check-revision',
        [DocumentController::class, 'checkRevision']
    )->middleware('role:iro_staff,iro_admin');

    Route::get(
        '/iro-admin/manage-submissions',
        [DocumentController::class, 'logged']
    )->middleware('role:iro_admin');

    Route::patch(
        '/documents/{document}/route-to-legal',
        [DocumentController::class, 'routeToLegal']
    )->middleware('role:iro_admin');

    Route::patch(
        '/submissions/{submissionId}/route-to-legal',
        [SubmissionRoutingController::class, 'routeToLegal']
    )->middleware('role:iro_admin');

    Route::get('/submissions/{submissionId}/files', [SubmissionFileController::class, 'index']);
    Route::post('/submissions/{submissionId}/files', [SubmissionFileController::class, 'store']);
    Route::get('/submissions/{submissionId}/files/{versionId}', [SubmissionFileController::class, 'show']);

    Route::get(
        '/legal-counsel/review-queue',
        [DocumentController::class, 'legalReviewQueue']
    )->middleware('role:legal_counsel');

    Route::patch(
        '/documents/{document}/approve',
        [DocumentController::class, 'approve']
    )->middleware('role:legal_counsel');

    Route::patch(
        '/documents/{document}/request-corrections',
        [DocumentController::class, 'requestCorrections']
    )->middleware('role:legal_counsel');

    Route::get(
        '/legal-counsel/notarization-queue',
        [DocumentController::class, 'notarizationQueue']
    )->middleware('role:legal_counsel');

    Route::post(
        '/documents/{document}/notarization',
        [DocumentController::class, 'recordNotarization']
    )->middleware('role:legal_counsel,iro_admin');

    Route::get(
        '/departments/{departmentId}/documents',
        [DocumentController::class, 'departmentDocuments']
    )->middleware('role:department_staff,iro_staff,iro_admin,super_admin');

    Route::get('/legal-counsels', [ProfileController::class, 'legalCounsels'])
        ->middleware('role:iro_admin');
    Route::get('/iro-staff', [ProfileController::class, 'iroStaff'])
        ->middleware('role:iro_admin');

    Route::put(
        '/iro-admin/documents/{document}/review-form/pending',
        [ReviewFormController::class, 'saveAdminPending']
    )->middleware('role:iro_admin');
});
