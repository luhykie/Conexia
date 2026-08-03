<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DistributionRecipient;
use App\Models\Document;
use App\Models\DocumentDistribution;
use App\Models\WorkflowEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DocumentDistributionController extends Controller
{
    public function index(): JsonResponse
    {
        $documents = Document::query()
            ->with(['distributions' => fn ($query) => $query->orderBy('recipient_name')])
            ->whereIn('status', ['Notarized', 'Ready for Distribution', 'Distribution Complete'])
            ->orderByDesc('updated_at')
            ->get();

        return response()->json(['data' => $documents]);
    }

    public function prepare(Request $request, Document $document): JsonResponse
    {
        if ($document->status !== 'Notarized') {
            return response()->json([
                'message' => 'Only notarized documents can be prepared for distribution.',
            ], 422);
        }

        $recipients = DistributionRecipient::query()
            ->where('document_type', $document->document_type)
            ->where('is_active', true)
            ->get();

        if ($recipients->isEmpty()) {
            return response()->json([
                'message' => "Add at least one active {$document->document_type} recipient before distribution.",
            ], 422);
        }

        DB::transaction(function () use ($request, $document, $recipients): void {
            foreach ($recipients as $recipient) {
                DocumentDistribution::firstOrCreate(
                    [
                        'document_id' => $document->id,
                        'distribution_recipient_id' => $recipient->id,
                    ],
                    [
                        'recipient_name' => $recipient->recipient_name,
                        'recipient_email' => $recipient->recipient_email,
                        'organization' => $recipient->organization,
                        'role_scope' => $recipient->role_scope,
                        'access_level' => $recipient->access_level,
                        'is_required' => $recipient->is_required,
                        'delivery_status' => 'Pending',
                    ]
                );
            }

            $document->update([
                'status' => 'Ready for Distribution',
                'updated_at' => now(),
            ]);
            $this->recordEvent(
                $request,
                $document,
                'distribution_prepared',
                'Notarized',
                'Ready for Distribution',
                "{$recipients->count()} recipient(s) added to the distribution record."
            );
        });

        return response()->json([
            'message' => 'Document prepared for distribution.',
            'data' => $document->fresh()->load('distributions'),
        ]);
    }

    public function markDelivered(
        Request $request,
        Document $document,
        DocumentDistribution $documentDistribution
    ): JsonResponse {
        if ($documentDistribution->document_id !== $document->id) {
            abort(404);
        }
        if ($document->status !== 'Ready for Distribution') {
            return response()->json([
                'message' => 'This document is not open for distribution.',
            ], 422);
        }

        $validated = $request->validate([
            'delivery_notes' => ['nullable', 'string', 'max:2000'],
        ]);
        $profile = $request->attributes->get('auth_profile');

        $documentDistribution->update([
            'delivery_status' => 'Delivered',
            'delivery_notes' => $validated['delivery_notes'] ?? null,
            'distributed_at' => now(),
            'distributed_by' => $profile->id,
        ]);

        return response()->json([
            'message' => 'Recipient delivery recorded.',
            'data' => $documentDistribution->fresh(),
        ]);
    }

    public function complete(Request $request, Document $document): JsonResponse
    {
        if ($document->status !== 'Ready for Distribution') {
            return response()->json([
                'message' => 'Only documents ready for distribution can be completed.',
            ], 422);
        }

        $total = $document->distributions()->count();
        $required = $document->distributions()
            ->where('is_required', true)
            ->count();
        $pendingRequired = $document->distributions()
            ->where('is_required', true)
            ->where('delivery_status', '!=', 'Delivered')
            ->count();

        if ($total === 0 || $required === 0 || $pendingRequired > 0) {
            return response()->json([
                'message' => 'Record delivery to every required recipient before completing distribution.',
            ], 422);
        }

        DB::transaction(function () use ($request, $document, $total): void {
            $document->update([
                'status' => 'Distribution Complete',
                'updated_at' => now(),
            ]);
            $this->recordEvent(
                $request,
                $document,
                'distribution_completed',
                'Ready for Distribution',
                'Distribution Complete',
                "Delivery confirmed for {$total} recipient(s)."
            );
        });

        return response()->json([
            'message' => 'Distribution completed. This record can now be archived.',
            'data' => $document->fresh()->load('distributions'),
        ]);
    }

    private function recordEvent(
        Request $request,
        Document $document,
        string $eventType,
        string $fromStatus,
        string $toStatus,
        string $notes
    ): void {
        $profile = $request->attributes->get('auth_profile');
        WorkflowEvent::create([
            'document_id' => $document->id,
            'actor_id' => $profile->id,
            'actor_role' => $profile->role,
            'event_type' => $eventType,
            'from_status' => $fromStatus,
            'to_status' => $toStatus,
            'notes' => $notes,
            'created_at' => now(),
        ]);
    }
}
