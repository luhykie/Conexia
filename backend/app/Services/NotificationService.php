<?php

namespace App\Services;

use App\Models\Document;
use App\Models\Notification;
use App\Models\Profile;
use Illuminate\Support\Collection;

class NotificationService
{
    public function documentSubmitted(Document $document): void
    {
        $department = $document->department()->value('name') ?? 'Unknown department';
        $message = "New {$document->document_type} submission {$document->tracking_number} from {$department} is waiting for review.";

        $this->notify(
            $this->activeProfiles(['iro_staff', 'iro_admin']),
            $document,
            'document_submitted',
            'New Incoming Document',
            $message,
            'submitted'
        );
    }

    public function documentLogged(Document $document, object $staff): void
    {
        $staffName = $staff->full_name ?? $staff->email;
        $message = "{$document->tracking_number} was logged by {$staffName} and is ready for admin validation.";
        $recipients = $this->activeProfiles(['iro_admin'])->push($staff);

        $this->notify($recipients, $document, 'document_logged', 'Document Logged', $message, 'logged');
    }

    public function revisionRequested(Document $document, string $remarks): void
    {
        $recipients = $this->activeProfiles(['iro_admin'])
            ->merge($this->profilesByIds([
                $document->submitted_by,
                $document->assigned_iro_staff,
            ]));

        $message = "{$document->tracking_number} was returned by Legal Counsel and requires revision. Remarks: {$remarks}";
        $version = $this->revisionNumber($document);

        $this->notify($recipients, $document, 'revision_requested', 'Revision Requested', $message, "revision-{$version}-requested");
    }

    public function revisionResubmitted(Document $document, int $version): void
    {
        $department = $document->department()->value('name') ?? 'Unknown department';
        $recipients = $this->activeProfiles(['iro_admin'])
            ->merge($this->profilesByIds([$document->assigned_iro_staff]));
        $message = "Revised version {$version} of {$document->tracking_number} from {$department} has been resubmitted and is ready for review.";

        $this->notify($recipients, $document, 'revision_resubmitted', 'Revised Document Resubmitted', $message, "revision-{$version}-resubmitted");
    }

    public function revisionChecked(Document $document, object $staff, int $version): void
    {
        $staffName = $staff->full_name ?? $staff->email;
        $message = "Revision {$version} of {$document->tracking_number} was checked by {$staffName}. Review Form status: ready for validation.";

        $this->notify(
            $this->activeProfiles(['iro_admin']),
            $document,
            'revision_checked',
            'Revision Checked',
            $message,
            "revision-{$version}-checked"
        );
    }

    public function routedToLegal(Document $document, int $version, bool $revision): void
    {
        $recipients = $this->profilesByIds([
            $document->assigned_legal_counsel,
            $document->assigned_iro_staff,
            $document->submitted_by,
        ]);

        if ($revision) {
            $message = "Corrected version {$version} of {$document->tracking_number} has been routed for another legal review.";
            $type = 'revision_routed_to_legal';
            $title = 'Revised Document Routed to Legal';
            $key = "revision-{$version}-routed";
        } else {
            $message = "{$document->tracking_number} has been routed to Legal Counsel for review.";
            $type = 'document_routed_to_legal';
            $title = 'Document Routed to Legal';
            $key = 'initial-route-to-legal';
        }

        $this->notify($recipients, $document, $type, $title, $message, $key);
    }

    public function submissionReassigned(
        Document $document,
        Profile $previousStaff,
        Profile $newStaff
    ): void {
        $previousName = $previousStaff->full_name ?: $previousStaff->email;
        $newName = $newStaff->full_name ?: $newStaff->email;
        $sequence = $document->workflowEvents()
            ->where('event_type', 'submission_reassigned')
            ->count();

        $this->notify(
            collect([$previousStaff, $newStaff]),
            $document,
            'submission_reassigned',
            'Submission Reassigned',
            "{$document->tracking_number} was reassigned from {$previousName} to {$newName}.",
            "reassignment-{$sequence}"
        );
    }

    public function revisionNumber(Document $document): int
    {
        return max(
            2,
            $document->workflowEvents()
                ->where('event_type', 'revision_resubmitted')
                ->count() + 2
        );
    }

    private function activeProfiles(array $roles): Collection
    {
        return Profile::query()
            ->where('is_active', true)
            ->whereIn('role', $roles)
            ->get();
    }

    private function profilesByIds(array $ids): Collection
    {
        return Profile::query()
            ->where('is_active', true)
            ->whereIn('id', array_values(array_filter($ids)))
            ->get();
    }

    private function notify(
        Collection $recipients,
        Document $document,
        string $type,
        string $title,
        string $message,
        string $eventKey
    ): void {
        foreach ($recipients->unique('id') as $recipient) {
            Notification::firstOrCreate(
                [
                    'dedupe_key' => "{$document->id}:{$eventKey}:{$recipient->id}",
                ],
                [
                    'user_id' => $recipient->id,
                    'document_id' => $document->id,
                    'type' => $type,
                    'title' => $title,
                    'message' => $message,
                    'is_read' => false,
                    'created_at' => now(),
                ]
            );
        }
    }
}
