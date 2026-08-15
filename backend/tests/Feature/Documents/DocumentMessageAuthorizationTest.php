<?php

namespace Tests\Feature\Documents;

use App\Models\DocumentMessage;
use App\Models\Profile;
use Tests\Feature\Support\SecurityTestCase;

class DocumentMessageAuthorizationTest extends SecurityTestCase
{
    public function test_iro_admins_can_exchange_messages_and_read_status_is_recorded(): void
    {
        $sender = $this->profile(Profile::ROLE_IRO_ADMIN);
        $reader = $this->profile(Profile::ROLE_IRO_ADMIN);
        $document = $this->document();
        $url = "/api/documents/{$document->id}/messages";

        $messageId = $this->postJson($url, [
            'message' => 'Please review the latest agreement version.',
        ], $this->authHeaders($sender))
            ->assertCreated()
            ->assertJsonPath('document_message.document_id', $document->id)
            ->assertJsonPath('document_message.sender_id', $sender->id)
            ->assertJsonPath('document_message.role', Profile::ROLE_IRO_ADMIN)
            ->assertJsonPath('document_message.is_read', false)
            ->json('document_message.id');

        $this->getJson($url, $this->authHeaders($reader))
            ->assertOk()
            ->assertJsonPath('messages.0.id', $messageId)
            ->assertJsonPath('messages.0.message', 'Please review the latest agreement version.')
            ->assertJsonPath('messages.0.is_read', true);

        $this->assertDatabaseHas('document_messages', [
            'id' => $messageId,
            'document_id' => $document->id,
            'sender_id' => $sender->id,
            'sender_role' => Profile::ROLE_IRO_ADMIN,
            'is_read' => true,
        ]);
    }

    public function test_department_staff_and_legal_counsel_cannot_access_document_chat(): void
    {
        $department = $this->department();
        $staff = $this->profile(Profile::ROLE_DEPARTMENT_STAFF, [
            'department_id' => $department->id,
        ]);
        $legal = $this->profile(Profile::ROLE_LEGAL_COUNSEL);
        $document = $this->document([
            'department_id' => $department->id,
            'assigned_legal_counsel' => $legal->id,
        ]);
        $url = "/api/documents/{$document->id}/messages";

        foreach ([$staff, $legal] as $profile) {
            $this->getJson($url, $this->authHeaders($profile))->assertForbidden();
            $this->postJson(
                $url,
                ['message' => 'Unauthorized'],
                $this->authHeaders($profile)
            )->assertForbidden();
        }
        $this->assertSame(0, DocumentMessage::query()->count());
    }

    public function test_iro_admin_can_reply_to_a_message_in_the_same_document(): void
    {
        $firstAdmin = $this->profile(Profile::ROLE_IRO_ADMIN);
        $secondAdmin = $this->profile(Profile::ROLE_IRO_ADMIN);
        $document = $this->document();
        $url = "/api/documents/{$document->id}/messages";

        $originalId = $this->postJson($url, [
            'message' => 'Can you confirm clause five?',
        ], $this->authHeaders($firstAdmin))->assertCreated()->json('document_message.id');

        $replyId = $this->postJson($url, [
            'message' => 'Clause five is confirmed.',
            'reply_to_message_id' => $originalId,
        ], $this->authHeaders($secondAdmin))
            ->assertCreated()
            ->assertJsonPath('document_message.reply_to_message_id', $originalId)
            ->assertJsonPath('document_message.reply_to.id', $originalId)
            ->assertJsonPath('document_message.reply_to.sender', $firstAdmin->full_name)
            ->assertJsonPath('document_message.reply_to.message', 'Can you confirm clause five?')
            ->json('document_message.id');

        $this->getJson($url, $this->authHeaders($firstAdmin))
            ->assertOk()
            ->assertJsonPath('messages.0.id', $originalId)
            ->assertJsonPath('messages.1.id', $replyId)
            ->assertJsonPath('messages.1.reply_to.id', $originalId);

        $this->assertDatabaseHas('document_messages', [
            'id' => $replyId,
            'document_id' => $document->id,
            'reply_to_message_id' => $originalId,
        ]);
    }

    public function test_reply_cannot_reference_a_message_from_another_document(): void
    {
        $admin = $this->profile(Profile::ROLE_IRO_ADMIN);
        $document = $this->document();
        $otherDocument = $this->document();
        $otherMessage = DocumentMessage::query()->create([
            'document_id' => $otherDocument->id,
            'sender_id' => $admin->id,
            'sender_role' => $admin->role,
            'message' => 'Message from another document.',
            'is_read' => false,
        ]);

        $this->postJson(
            "/api/documents/{$document->id}/messages",
            [
                'message' => 'Invalid cross-document reply.',
                'reply_to_message_id' => $otherMessage->id,
            ],
            $this->authHeaders($admin)
        )->assertUnprocessable()->assertJsonValidationErrors('reply_to_message_id');
    }

    public function test_iro_staff_chat_access_is_rejected_by_existing_role_boundary(): void
    {
        $iroStaff = $this->profile(Profile::ROLE_IRO_STAFF);
        $document = $this->document();

        $this->getJson(
            "/api/documents/{$document->id}/messages",
            $this->authHeaders($iroStaff)
        )->assertForbidden();
    }
}
