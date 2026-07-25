<?php

use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\SubmissionController;
use Illuminate\Support\Facades\Route;

Route::get('/health', [HealthController::class, 'show']);

Route::middleware('supabase.jwt')->group(function () {
    Route::get('/submissions', [SubmissionController::class, 'index']);
    Route::post('/submissions', [SubmissionController::class, 'store']);
    Route::get('/submissions/{submission}', [SubmissionController::class, 'show']);
    Route::patch('/submissions/{submission}/status', [SubmissionController::class, 'updateStatus']);
    Route::post('/submissions/{submission}/review-form', [SubmissionController::class, 'generateReviewForm']);
    Route::post('/submissions/{submission}/notarization-form', [SubmissionController::class, 'generateNotarizationForm']);
    Route::post('/submissions/{submission}/notarization', [SubmissionController::class, 'recordNotarization']);
    Route::post('/submissions/{submission}/archive', [SubmissionController::class, 'archiveSubmission']);
    Route::post('/submissions/{submission}/distribute', [SubmissionController::class, 'distributeSubmission']);
});
