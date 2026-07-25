<?php

use App\Http\Controllers\Api\DocumentController;
use Illuminate\Support\Facades\Route;

Route::get('/documents', [
    DocumentController::class,
    'index',
]);

Route::post('/documents', [
    DocumentController::class,
    'store',
]);

Route::get('/documents/{document}', [
    DocumentController::class,
    'show',
]);

Route::get('/iro-staff/incoming', [
    DocumentController::class,
    'incoming',
]);

Route::patch('/documents/{document}/log', [
    DocumentController::class,
    'log',
]);

Route::get('/iro-admin/manage-submissions', [
    DocumentController::class,
    'logged',
]);

Route::patch('/documents/{document}/route-to-legal', [
    DocumentController::class,
    'routeToLegal',
]);

Route::patch('/documents/{document}/approve', [
    DocumentController::class,
    'approve',
]);

Route::patch('/documents/{document}/request-corrections', [
    DocumentController::class,
    'requestCorrections',
]);

Route::get('/departments/{departmentId}/documents', [
    DocumentController::class,
    'departmentDocuments',
]);