<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Models\Notification;
use App\Models\Profile;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $profile = $this->profile($request);
        $options = Pagination::options(
            $request,
            ['created_at', 'read_at', 'notification_type'],
            'created_at'
        );
        $operator = Pagination::searchOperator();

        $notifications = Notification::query()
            ->with('document')
            ->where('user_id', $profile->id)
            ->when(
                $options['search'] !== '',
                fn ($query) => $query->where(function ($builder) use ($options, $operator) {
                    $builder
                        ->where('title', $operator, "%{$options['search']}%")
                        ->orWhere('message', $operator, "%{$options['search']}%");
                })
            )
            ->orderBy($options['sort'], $options['direction'])
            ->paginate(
                $options['per_page'],
                ['*'],
                'page',
                $options['page']
            );

        $items = $notifications
            ->map(fn (Notification $notification): array =>
                $this->payload($notification, $profile)
            )
            ->values();

        return $this->success(
            'Notifications loaded successfully.',
            $items,
            [
                'notifications' => $items,
                'meta' => Pagination::meta($notifications),
            ]
        );
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => ['required', 'uuid', 'exists:profiles,id'],
            'document_id' => ['nullable', 'uuid', 'exists:documents,id'],
            'title' => ['required', 'string', 'max:255'],
            'message' => ['required', 'string', 'max:2000'],
            'notification_type' => ['required', 'string', 'max:100'],
        ]);

        $profile = $this->profile($request);

        if (
            !empty($validated['document_id']) &&
            !$this->canAccessDocument(
                $profile,
                $validated['document_id']
            )
        ) {
            return response()->json([
                'success' => false,
                'message' => 'The selected document could not be found.',
                'errors' => [],
            ], 404);
        }

        $notification = Notification::query()->create([
            ...$validated,
            'is_read' => false,
        ]);

        return $this->success(
            'Notification created successfully.',
            $this->payload($notification, $profile),
            [
                'notification' =>
                    $this->payload($notification, $profile),
            ]
        );
    }

    public function unreadCount(Request $request): JsonResponse
    {
        $profile = $this->profile($request);

        $count = Notification::query()
            ->where('user_id', $profile->id)
            ->where('is_read', false)
            ->count();

        return $this->success(
            'Unread notification count loaded successfully.',
            ['count' => $count],
            ['count' => $count]
        );
    }

    public function markRead(
        Request $request,
        string $id
    ): JsonResponse {
        $profile = $this->profile($request);

        $notification = Notification::query()
            ->whereKey($id)
            ->where('user_id', $profile->id)
            ->firstOrFail();

        if (!$notification->is_read) {
            $notification->update([
                'is_read' => true,
                'read_at' => now(),
            ]);
        }

        return $this->success(
            'Notification marked as read.',
            $this->payload($notification->refresh(), $profile),
            [
                'notification' =>
                    $this->payload($notification, $profile),
            ]
        );
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $profile = $this->profile($request);

        Notification::query()
            ->where('user_id', $profile->id)
            ->where('is_read', false)
            ->update([
                'is_read' => true,
                'read_at' => now(),
            ]);

        return $this->success(
            'All notifications marked as read.',
            []
        );
    }

    private function profile(Request $request): Profile
    {
        return $request->attributes->get(
            'authenticated_profile'
        );
    }

    private function payload(
        Notification $notification,
        Profile $profile
    ): array
    {
        $notification->loadMissing('document');

        return [
            'id' => $notification->id,
            'title' => $notification->title,
            'message' => $notification->message,
            'notification_type' =>
                $notification->notification_type,
            'is_read' => (bool) $notification->is_read,
            'created_at' =>
                $notification->created_at?->toISOString(),
            'read_at' =>
                $notification->read_at?->toISOString(),
            'document_id' => $notification->document_id,
            'documents' => $notification->document &&
                $this->canAccessDocument(
                    $profile,
                    $notification->document->id
                )
                ? [
                    'tracking_number' =>
                        $notification->document->tracking_number,
                    'title' => $notification->document->title,
                    'status' => $notification->document->status,
                ]
                : null,
        ];
    }

    private function canAccessDocument(
        Profile $profile,
        string $documentId
    ): bool {
        $document = Document::query()
            ->whereKey($documentId)
            ->first();

        return $document &&
            Gate::forUser($profile)->allows(
                'view-document-metadata',
                $document
            );
    }

    private function success(
        string $message,
        mixed $data,
        array $extra = []
    ): JsonResponse {
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $data,
            ...$extra,
        ]);
    }
}
