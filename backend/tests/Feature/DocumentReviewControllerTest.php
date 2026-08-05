<?php

namespace Tests\Feature;

use App\Models\Submission;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DocumentReviewControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_review_comments_can_be_created_for_a_submission(): void
    {
        $submission = Submission::create([
            'id' => '00000000-0000-4000-8000-000000000100',
            'submitted_by' => '00000000-0000-4000-8000-000000000010',
            'tracking_number' => 'SCS-001',
            'title' => 'Test agreement',
            'office' => 'Office of Partnerships',
            'department' => 'CBA',
            'contact_person' => 'Test Contact',
            'contact_position' => 'Head',
            'contact_email' => 'contact@example.com',
            'contact_number' => '123',
            'partner_institution_name' => 'Partner University',
            'agreement_type' => 'Memorandum of Agreement (MOA)',
            'agreement_title' => 'Academic Exchange',
            'expected_duration' => '5 Years',
            'partner_contact_email' => 'partner@example.com',
            'requested_by_name' => 'Requester',
            'status' => 'pending_iro_staff_review',
            'current_stage' => 'iro_staff',
            'version' => 1,
            'revision_cycle' => 1,
        ]);

        $response = $this->withHeader('Authorization', 'Bearer dev:irostaff@conexia.edu')
            ->postJson("/api/submissions/{$submission->id}/review/comments", [
                'comment' => 'Please update the partner address.',
                'page_number' => 2,
                'selected_text' => 'Clause 2',
                'highlight_coordinates' => ['left' => 120, 'top' => 180, 'width' => 320, 'height' => 18],
            ]);

        $response->assertStatus(201);
        $response->assertJsonPath('data.comment', 'Please update the partner address.');
        $this->assertDatabaseHas('document_comments', [
            'submission_id' => $submission->id,
            'comment' => 'Please update the partner address.',
        ]);
    }
}
