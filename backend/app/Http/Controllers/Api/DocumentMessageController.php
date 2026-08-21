<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Models\DocumentMessage;
use App\Models\Profile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class DocumentMessageController extends Controller
{
    public function index(Request $request, Document $document): JsonResponse
    {
        $profile = $this->authorizeParticipant($request, $document);

        DocumentMessage::query()
            ->where('document_id', $document->id)
            ->where('sender_id', '!=', $profile->id)
            ->where('is_read', false)
            ->update(['is_read' => true, 'read_at' => now()]);

        $messages = DocumentMessage::query()
            ->with(['sender', 'replyTo.sender'])
            ->where('document_id', $document->id)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(200)
            ->get()
            ->reverse()
            ->map(fn (DocumentMessage $message): array => $this->payload($message, $profile))
            ->values();

        return response()->json([
            'success' => true,
            'message' => 'Document messages loaded successfully.',
            'messages' => $messages,
        ]);
    }

    public function store(Request $request, Document $document): JsonResponse
    {
        $profile = $this->authorizeParticipant($request, $document);
        $validated = $request->validate([
            'message' => ['required', 'string', 'max:2000'],
            'reply_to_message_id' => ['nullable', 'uuid'],
        ]);
        $text = trim($validated['message']);

        if ($text === '') {
            return response()->json([
                'success' => false,
                'message' => 'The message field is required.',
                'errors' => ['message' => ['The message field is required.']],
            ], 422);
        }

        $replyTo = null;
        if (!empty($validated['reply_to_message_id'])) {
            $replyTo = DocumentMessage::query()
                ->with('sender')
                ->whereKey($validated['reply_to_message_id'])
                ->where('document_id', $document->id)
                ->first();

            if (!$replyTo) {
                return response()->json([
                    'success' => false,
                    'message' => 'The selected reply message is invalid.',
                    'errors' => [
                        'reply_to_message_id' => [
                            'The selected reply message is invalid.',
                        ],
                    ],
                ], 422);
            }
        }

        $message = DocumentMessage::query()->create([
            'document_id' => $document->id,
            'sender_id' => $profile->id,
            'sender_role' => $profile->role,
            'reply_to_message_id' => $replyTo?->id,
            'message' => $text,
            'is_read' => false,
        ]);
        $message->setRelation('sender', $profile);
        $message->setRelation('replyTo', $replyTo);

        return response()->json([
            'success' => true,
            'message' => 'Message sent successfully.',
            'document_message' => $this->payload($message, $profile),
        ], 201);
    }

    private function authorizeParticipant(Request $request, Document $document): Profile
    {
        $profile = $request->attributes->get('authenticated_profile');

        if (
            !$profile ||
            !in_array($profile->role, [
                Profile::ROLE_IRO_ADMIN,
                Profile::ROLE_LEGAL_COUNSEL,
                Profile::ROLE_DEPARTMENT_STAFF,
            ], true) ||
            Gate::forUser($profile)->denies('view-document-metadata', $document)
        ) {
            throw new NotFoundHttpException('The requested document could not be found.');
        }

        if (
            $profile->role === Profile::ROLE_DEPARTMENT_STAFF &&
            $document->submitted_by !== $profile->id
        ) {
            throw new NotFoundHttpException('The requested document could not be found.');
        }

        return $profile;
    }

    private function payload(
        DocumentMessage $message,
        Profile $currentProfile
    ): array
    {
        return [
            'id' => $message->id,
            'document_id' => $message->document_id,
            'sender_id' => $message->sender_id,
            'is_mine' => $message->sender_id === $currentProfile->id,
            'sender' => $message->sender?->full_name ?: $message->sender?->email,
            'role' => $message->sender_role,
            'message' => $message->message,
            'reply_to_message_id' => $message->reply_to_message_id,
            'reply_to' => $message->replyTo
                ? [
                    'id' => $message->replyTo->id,
                    'sender' => $message->replyTo->sender?->full_name
                        ?: $message->replyTo->sender?->email,
                    'role' => $message->replyTo->sender_role,
                    'message' => $message->replyTo->message,
                ]
                : null,
            'timestamp' => $message->created_at?->toISOString(),
            'is_read' => $message->is_read,
            'read_at' => $message->read_at?->toISOString(),
        ];
    }
}
