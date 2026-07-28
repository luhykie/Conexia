<?php

use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\SubmissionController;
use Illuminate\Support\Facades\Route;

Route::get('/health', [HealthController::class, 'show']);

Route::middleware('supabase.jwt')->group(function () {
    Route::get('/submissions', [SubmissionController::class, 'index']);
    Route::post('/submissions', [SubmissionController::class, 'store']);
    Route::get('/submissions/{submissionId}', [SubmissionController::class, 'show']);
    Route::patch('/submissions/{submissionId}', [SubmissionController::class, 'update']);
    Route::get('/submissions/{submissionId}/file', [SubmissionController::class, 'downloadFile']);
    Route::patch('/submissions/{submissionId}/status', [SubmissionController::class, 'updateStatus']);
    Route::post('/submissions/{submissionId}/review-form', [SubmissionController::class, 'generateReviewForm']);
    Route::post('/submissions/{submissionId}/notarization-form', [SubmissionController::class, 'generateNotarizationForm']);
    Route::post('/submissions/{submissionId}/notarization', [SubmissionController::class, 'recordNotarization']);
    Route::post('/submissions/{submissionId}/archive', [SubmissionController::class, 'archiveSubmission']);
    Route::post('/submissions/{submissionId}/distribute', [SubmissionController::class, 'distributeSubmission']);
});
