<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $notifications = Notification::query()
            ->with('document:id,tracking_number,status,document_type')
            ->where('user_id', $this->profileId($request))
            ->orderByDesc('created_at')
            ->paginate(25);

        $notifications->getCollection()->transform(
            fn (Notification $notification): array => $this->serialize($notification)
        );

        return response()->json($notifications);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        return response()->json([
            'data' => [
                'count' => Notification::query()
                    ->where('user_id', $this->profileId($request))
                    ->where('is_read', false)
                    ->count(),
            ],
        ]);
    }

    public function markRead(Request $request, Notification $notification): JsonResponse
    {
        $this->ensureOwner($request, $notification);

        if (! $notification->is_read) {
            $notification->update([
                'is_read' => true,
                'read_at' => now(),
            ]);
        }

        return response()->json([
            'message' => 'Notification marked as read.',
            'data' => $this->serialize($notification->fresh('document')),
        ]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $updated = DB::transaction(fn (): int => Notification::query()
            ->where('user_id', $this->profileId($request))
            ->where('is_read', false)
            ->update([
                'is_read' => true,
                'read_at' => now(),
            ]));

        return response()->json([
            'message' => 'All notifications marked as read.',
            'data' => ['updated' => $updated],
        ]);
    }

    public function destroy(Request $request, Notification $notification): JsonResponse
    {
        $this->ensureOwner($request, $notification);
        $notification->delete();

        return response()->json(status: 204);
    }

    private function profileId(Request $request): string
    {
        return $request->attributes->get('auth_profile')->id;
    }

    private function ensureOwner(Request $request, Notification $notification): void
    {
        if ($notification->user_id !== $this->profileId($request)) {
            abort(404);
        }
    }

    private function serialize(Notification $notification): array
    {
        return [
            'id' => $notification->id,
            'user_id' => $notification->user_id,
            'document_id' => $notification->document_id,
            'type' => $notification->type,
            'title' => $notification->title,
            'message' => $notification->message,
            'is_read' => $notification->is_read,
            'created_at' => $notification->created_at,
            'read_at' => $notification->read_at,
            'document' => $notification->document,
        ];
    }
}
