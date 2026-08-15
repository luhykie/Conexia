<?php

namespace Tests\Feature\Notifications;

use App\Models\Profile;
use Tests\Feature\Support\SecurityTestCase;

class NotificationAuthorizationTest extends SecurityTestCase
{
    public function test_iro_roles_receive_and_update_their_own_unread_count(): void
    {
        foreach ([Profile::ROLE_IRO_ADMIN, Profile::ROLE_IRO_STAFF] as $role) {
            $profile = $this->profile($role);
            $otherProfile = $this->profile($role);
            $unread = $this->notification(['user_id' => $profile->id]);
            $this->notification([
                'user_id' => $profile->id,
                'is_read' => true,
                'read_at' => now(),
            ]);
            $this->notification(['user_id' => $otherProfile->id]);

            $this->getJson(
                '/api/notifications/unread-count',
                $this->authHeaders($profile)
            )->assertOk()->assertJsonPath('count', 1);

            $this->patchJson(
                "/api/notifications/{$unread->id}/read",
                [],
                $this->authHeaders($profile)
            )
                ->assertOk()
                ->assertJsonPath('notification.is_read', true);

            $this->getJson(
                '/api/notifications/unread-count',
                $this->authHeaders($profile)
            )->assertOk()->assertJsonPath('count', 0);

            $this->notification(['user_id' => $profile->id]);
            $this->patchJson(
                '/api/notifications/read-all',
                [],
                $this->authHeaders($profile)
            )->assertOk();

            $this->getJson(
                '/api/notifications/unread-count',
                $this->authHeaders($profile)
            )->assertOk()->assertJsonPath('count', 0);
        }
    }

    public function test_user_reads_only_their_own_notifications(): void
    {
        $user = $this->profile(Profile::ROLE_LEGAL_COUNSEL);
        $otherUser = $this->profile(Profile::ROLE_LEGAL_COUNSEL);

        $ownNotification = $this->notification([
            'user_id' => $user->id,
            'title' => 'Mine',
        ]);

        $otherNotification = $this->notification([
            'user_id' => $otherUser->id,
            'title' => 'Other',
        ]);

        $response = $this->getJson(
            '/api/notifications',
            $this->authHeaders($user)
        )->assertOk();

        $response->assertJsonFragment(['id' => $ownNotification->id]);
        $response->assertJsonMissing(['id' => $otherNotification->id]);
    }

    public function test_document_metadata_is_included_only_when_gate_allows_it(): void
    {
        $legal = $this->profile(Profile::ROLE_LEGAL_COUNSEL);
        $otherLegal = $this->profile(Profile::ROLE_LEGAL_COUNSEL);

        $accessibleDocument = $this->document([
            'assigned_legal_counsel' => $legal->id,
        ]);

        $inaccessibleDocument = $this->document([
            'assigned_legal_counsel' => $otherLegal->id,
        ]);

        $this->notification([
            'user_id' => $legal->id,
            'document_id' => $accessibleDocument->id,
            'title' => 'Accessible',
        ]);

        $this->notification([
            'user_id' => $legal->id,
            'document_id' => $inaccessibleDocument->id,
            'title' => 'Hidden metadata',
        ]);

        $response = $this->getJson(
            '/api/notifications',
            $this->authHeaders($legal)
        )->assertOk();

        $notifications = collect($response->json('notifications'));

        $this->assertNotNull(
            $notifications
                ->firstWhere('title', 'Accessible')['documents']
        );

        $this->assertNull(
            $notifications
                ->firstWhere('title', 'Hidden metadata')['documents']
        );
    }

    public function test_user_cannot_mark_another_users_notification_as_read(): void
    {
        $user = $this->profile(Profile::ROLE_LEGAL_COUNSEL);
        $otherUser = $this->profile(Profile::ROLE_LEGAL_COUNSEL);

        $notification = $this->notification([
            'user_id' => $otherUser->id,
        ]);

        $this->patchJson(
            "/api/notifications/{$notification->id}/read",
            [],
            $this->authHeaders($user)
        )->assertNotFound();
    }

    public function test_notification_create_rejects_inaccessible_document_metadata(): void
    {
        $legal = $this->profile(Profile::ROLE_LEGAL_COUNSEL);
        $otherLegal = $this->profile(Profile::ROLE_LEGAL_COUNSEL);

        $document = $this->document([
            'assigned_legal_counsel' => $otherLegal->id,
        ]);

        $this->postJson(
            '/api/notifications',
            [
                'user_id' => $legal->id,
                'document_id' => $document->id,
                'title' => 'Nope',
                'message' => 'Hidden document',
                'notification_type' => 'document_update',
            ],
            $this->authHeaders($legal)
        )->assertNotFound();
    }
}
