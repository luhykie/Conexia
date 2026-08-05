<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\SubmissionController;
use App\Http\Controllers\Api\DocumentReviewController;
use Illuminate\Support\Facades\Route;

Route::get('/health', [HealthController::class, 'show']);
Route::post('/login', [AuthController::class, 'login']);

Route::middleware('supabase.jwt')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::get('/submissions', [SubmissionController::class, 'index']);
    Route::post('/submissions', [SubmissionController::class, 'store']);
    Route::get('/submissions/{submissionId}', [SubmissionController::class, 'show']);
    Route::patch('/submissions/{submissionId}', [SubmissionController::class, 'update']);
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
