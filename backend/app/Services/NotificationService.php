<?php

namespace App\Services;

use App\Models\Document;
use App\Models\Notification;
use App\Models\Profile;
use App\Models\DocumentDistribution;
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
        // Legal Counsel returns the result to IRO Admin first. IRO Staff and
        // the department are notified only by their authorized handoff steps.
        $recipients = $this->activeProfiles(['iro_admin']);

        $message = "{$document->tracking_number} was returned by Legal Counsel and requires revision. Remarks: {$remarks}";
        $version = $this->revisionNumber($document);

        $this->notify($recipients, $document, 'revision_requested', 'Revision Requested', $message, "revision-{$version}-requested");
    }

    public function revisionAssignedToStaff(Document $document, Profile $staff): void
    {
        $this->notify(
            collect([$staff]),
            $document,
            'revision_assigned_to_iro_staff',
            'Revision Handling Assigned',
            "{$document->tracking_number} was assigned to you to forward Legal Counsel's revision request to the designated department.",
            'revision-assigned-to-staff'
        );
    }

    public function revisionSentToDepartment(Document $document): void
    {
        $recipients = Profile::query()
            ->where('role', 'department_staff')
            ->where('department_id', $document->department_id)
            ->where('is_active', true)
            ->get();

        $this->notify(
            $recipients,
            $document,
            'revision_sent_to_department',
            'Document Revision Required',
            "{$document->tracking_number} requires revision. Review Legal Counsel's comments and upload the corrected document.",
            'revision-sent-to-department'
        );
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

    public function legalApproved(Document $document): void
    {
        $recipients = $this->activeProfiles(['iro_admin'])
            ->merge($this->profilesByIds([$document->assigned_iro_staff]));
        $sequence = $document->workflowEvents()
            ->where('event_type', 'legal_approved')
            ->count();

        $this->notify(
            $recipients,
            $document,
            'legal_approved',
            'Document Approved by Legal Counsel',
            "{$document->tracking_number} was approved by Legal Counsel and is ready for IRO Staff distribution assignment.",
            "legal-approved-{$sequence}"
        );
    }

    public function distributionAssignedToStaff(Document $document, Profile $staff): void
    {
        $this->notify(
            collect([$staff]),
            $document,
            'distribution_assigned_to_iro_staff',
            'Approved Document Assigned for Distribution',
            "{$document->tracking_number} was assigned to you for distribution to its designated departments.",
            'distribution-assigned-to-staff'
        );
    }

    public function distributionDeliveredToDepartment(
        Document $document,
        DocumentDistribution $distribution
    ): void {
        $recipients = Profile::query()
            ->where('role', 'department_staff')
            ->where('department_id', $document->department_id)
            ->where('is_active', true)
            ->get();

        $this->notify(
            $recipients,
            $document,
            'document_delivered_to_department',
            'Approved Document Delivered',
            "{$document->tracking_number} was delivered to {$distribution->recipient_name} and is now available to the originating department.",
            "distribution-{$distribution->id}-delivered"
        );
    }

    public function distributionCompleted(Document $document): void
    {
        $this->notify(
            $this->activeProfiles(['iro_admin']),
            $document,
            'distribution_completed',
            'Distribution Completed',
            "Distribution of {$document->tracking_number} is complete. Review the final document and archive the record.",
            'distribution-completed'
        );
    }

    public function submissionReassigned(
        Document $document,
        ?Profile $previousStaff,
        Profile $newStaff,
        string $reason
    ): void {
        $previousName = $previousStaff
            ? ($previousStaff->full_name ?: $previousStaff->email)
            : 'Unassigned';
        $newName = $newStaff->full_name ?: $newStaff->email;
        $sameStaff = $previousStaff && $previousStaff->id === $newStaff->id;
        $sequence = $document->workflowEvents()
            ->where('event_type', 'submission_reassigned')
            ->count();

        $this->notify(
            collect([$previousStaff, $newStaff])->filter(),
            $document,
            'submission_reassigned',
            'Submission Reassigned',
            $sameStaff
                ? "{$document->tracking_number} was returned to you for further action. Reason: {$reason}"
                : "{$document->tracking_number} was reassigned from {$previousName} to {$newName}. Reason: {$reason}",
            "reassignment-{$sequence}"
        );
    }

    public function documentNotarized(Document $document): void
    {
        $recipients = $this->activeProfiles(['iro_admin'])
            ->merge($this->profilesByIds([
                $document->assigned_iro_staff,
                $document->assigned_legal_counsel,
                $document->submitted_by,
            ]));

        $this->notify(
            $recipients,
            $document,
            'document_notarized',
            'Document Notarized',
            "{$document->tracking_number} was notarized under reference {$document->notarial_reference_number}.",
            'notarized'
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
