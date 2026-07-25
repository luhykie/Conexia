<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Document;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DocumentController extends Controller
{
    /**
     * GET /api/documents
     * Return all documents.
     */
    public function index(): JsonResponse
    {
        $documents = Document::query()
            ->orderByDesc('submitted_at')
            ->get();

        return response()->json([
            'data' => $documents,
        ]);
    }

    /**
     * POST /api/documents
     * Department Staff submits a document.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'tracking_number' => [
                'required',
                'string',
                'max:255',
                'unique:documents,tracking_number',
            ],
            'title' => ['required', 'string', 'max:255'],
            'document_type' => [
                'required',
                'string',
                Rule::in(['MOA', 'MOU', 'MOF']),
            ],
            'partner_institution' => [
                'required',
                'string',
                'max:255',
            ],
            'partner_email' => [
                'nullable',
                'email',
                'max:255',
            ],
            'description' => [
                'nullable',
                'string',
            ],
            'department_id' => [
                'required',
                'uuid',
            ],
            'submitted_by' => [
                'required',
                'uuid',
            ],
        ]);

        $document = Document::create([
            ...$validated,
            'status' => 'Submitted',
            'submitted_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'message' => 'Document submitted successfully.',
            'data' => $document,
        ], 201);
    }

    /**
     * GET /api/iro-staff/incoming
     * Return documents waiting for IRO Staff.
     */
    public function incoming(): JsonResponse
    {
        $documents = Document::query()
            ->where('status', 'Submitted')
            ->orderByDesc('submitted_at')
            ->get();

        return response()->json([
            'data' => $documents,
        ]);
    }

    /**
     * GET /api/documents/{document}
     * Return one document.
     */
    public function show(Document $document): JsonResponse
    {
        return response()->json([
            'data' => $document,
        ]);
    }

    /**
     * PATCH /api/documents/{document}/log
     * IRO Staff submits a document to IRO Admin.
     */
    public function log(
        Request $request,
        Document $document
    ): JsonResponse {
        $validated = $request->validate([
            'iro_staff_id' => [
                'required',
                'uuid',
            ],
        ]);

        if ($document->status !== 'Submitted') {
            return response()->json([
                'message' =>
                    'Only submitted documents can be logged.',
            ], 422);
        }

        $document->update([
            'assigned_iro_staff' =>
                $validated['iro_staff_id'],
            'status' => 'Logged',
            'updated_at' => now(),
        ]);

        return response()->json([
            'message' =>
                'Document submitted to IRO Admin.',
            'data' => $document->fresh(),
        ]);
    }

    /**
     * GET /api/iro-admin/manage-submissions
     * Return documents waiting for IRO Admin validation.
     */
    public function logged(): JsonResponse
    {
        $documents = Document::query()
            ->where('status', 'Logged')
            ->orderByDesc('updated_at')
            ->get();

        return response()->json([
            'data' => $documents,
        ]);
    }

    /**
     * PATCH /api/documents/{document}/route-to-legal
     * IRO Admin routes a logged document to Legal Counsel.
     */
    public function routeToLegal(
        Request $request,
        Document $document
    ): JsonResponse {
        $validated = $request->validate([
            'legal_counsel_id' => [
                'required',
                'uuid',
            ],
        ]);

        if ($document->status !== 'Logged') {
            return response()->json([
                'message' =>
                    'Only logged documents can be routed to Legal Counsel.',
            ], 422);
        }

        $document->update([
            'assigned_legal_counsel' =>
                $validated['legal_counsel_id'],
            'status' => 'Under Legal Review',
            'updated_at' => now(),
        ]);

        return response()->json([
            'message' =>
                'Document routed to Legal Counsel.',
            'data' => $document->fresh(),
        ]);
    }

    /**
     * PATCH /api/documents/{document}/approve
     * Legal Counsel approves the document.
     */
    public function approve(
        Document $document
    ): JsonResponse {
        if ($document->status !== 'Under Legal Review') {
            return response()->json([
                'message' =>
                    'Only documents under legal review can be approved.',
            ], 422);
        }

        $document->update([
            'status' => 'Approved',
            'updated_at' => now(),
        ]);

        return response()->json([
            'message' => 'Document approved.',
            'data' => $document->fresh(),
        ]);
    }

    /**
     * PATCH /api/documents/{document}/request-corrections
     * Legal Counsel sends the document back for corrections.
     */
    public function requestCorrections(
        Request $request,
        Document $document
    ): JsonResponse {
        $validated = $request->validate([
            'remarks' => [
                'required',
                'string',
                'max:5000',
            ],
        ]);

        if ($document->status !== 'Under Legal Review') {
            return response()->json([
                'message' =>
                    'Only documents under legal review can be returned for corrections.',
            ], 422);
        }

        $document->update([
            'status' => 'Corrections Needed',
            'legal_notes' => $validated['remarks'],
            'updated_at' => now(),
        ]);

        return response()->json([
            'message' =>
                'Document returned for corrections.',
            'data' => $document->fresh(),
        ]);
    }

    /**
     * GET /api/departments/{departmentId}/documents
     * Return documents owned by one department.
     */
    public function departmentDocuments(
        string $departmentId
    ): JsonResponse {
        $documents = Document::query()
            ->where('department_id', $departmentId)
            ->orderByDesc('submitted_at')
            ->get();

        return response()->json([
            'data' => $documents,
        ]);
    }
}