<?php

namespace App\Services;

use App\Models\Profile;
use App\Models\ReviewForm;
use App\Models\NotarizationForm;
use App\Models\Submission;
use App\Models\SubmissionVersion;
use App\Models\WorkflowEvent;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SubmissionWorkflowService
{
    public function createSubmission(Profile $profile, array $payload): Submission
    {
        if ($profile->role_key !== 'department') {
            throw ValidationException::withMessages([
                'role' => ['Only Department Staff can create submissions.'],
            ]);
        }

        return DB::transaction(function () use ($profile, $payload) {
            $trackingNumber = $this->generateTrackingNumber();

            $submission = Submission::query()->create([
                'tracking_number' => $trackingNumber,
                'submitted_by' => $profile->id,
                'office' => $profile->office,
                'department' => $profile->department,
                'contact_person' => $payload['contact_person'],
                'contact_position' => $payload['contact_position'],
                'contact_email' => $payload['contact_email'],
                'contact_number' => $payload['contact_number'],
                'partner_institution_name' => $payload['partner_institution_name'],
                'agreement_type' => $payload['agreement_type'],
                'agreement_title' => $payload['agreement_title'],
                'expected_duration' => $payload['expected_duration'],
                'partner_contact_email' => $payload['partner_contact_email'],
                'requested_completion_date' => $payload['requested_completion_date'],
                'urgency_level' => $payload['urgency_level'],
                'requested_by_name' => $payload['requested_by_name'],
                'requested_by_date' => $payload['requested_by_date'] ?? now()->toDateString(),
                'noted_by_name' => $payload['noted_by_name'] ?? null,
                'noted_by_date' => $payload['noted_by_date'] ?? null,
                'storage_path' => $payload['storage_path'] ?? null,
                'file_name' => $payload['file_name'] ?? null,
                'status' => 'under_review',
            ]);

            if (! empty($payload['storage_path']) && ! empty($payload['file_name'])) {
                SubmissionVersion::query()->create([
                    'submission_id' => $submission->id,
                    'version_number' => 1,
                    'storage_path' => $payload['storage_path'],
                    'file_name' => $payload['file_name'],
                    'uploaded_by' => $profile->id,
                    'upload_reason' => 'original_draft',
                ]);
            }

            $this->recordEvent(
                submission: $submission,
                actorId: $profile->id,
                fromStatus: null,
                toStatus: 'under_review',
                action: 'department_submitted',
                notes: 'Submission sent to PAIR for logging and review.',
            );

            return $submission->fresh(['versions', 'workflowEvents']);
        });
    }

    public function updateStatus(Profile $profile, Submission $submission, string $toStatus, ?string $notes = null, array $metadata = []): Submission
    {
        $this->assertCanTransition($profile, $submission, $toStatus);

        return DB::transaction(function () use ($profile, $submission, $toStatus, $notes, $metadata) {
            $fromStatus = $submission->status;
            $updates = ['status' => $toStatus];

            if (in_array($toStatus, ['logged', 'review_form_generated'], true) && in_array($profile->role_key, ['staff', 'admin'], true)) {
                $updates['date_received'] = $updates['date_received'] ?? now();
                $updates['received_by'] = $profile->id;
            }

            if ($toStatus === 'review_form_generated') {
                $updates['review_form_generated_at'] = now();
            }

            if ($toStatus === 'notarization_form_generated') {
                $updates['notarization_form_generated_at'] = now();
            }

            if ($toStatus === 'under_review' && $fromStatus === 'logged') {
                $updates['date_received'] = $submission->date_received ?? now();
                $updates['received_by'] = $submission->received_by ?? $profile->id;
            }

            $submission->update($updates);

            $this->recordEvent(
                submission: $submission,
                actorId: $profile->id,
                fromStatus: $fromStatus,
                toStatus: $toStatus,
                action: 'status_updated',
                notes: $notes,
                metadata: $metadata,
            );

            return $submission->fresh(['versions', 'workflowEvents']);
        });
    }

    private function assertCanTransition(Profile $profile, Submission $submission, string $toStatus): void
    {
        $allowed = match ($profile->role_key) {
            'department' => [
                'corrections_needed' => ['resubmitted'],
            ],
            'staff', 'admin' => [
                'under_review' => ['logged'],
                'logged' => ['review_form_generated', 'under_review'],
                'review_form_generated' => ['under_review'],
                'resubmitted' => ['under_review'],
                'approved' => ['notarization_form_generated', 'pending_notarization'],
                'notarization_form_generated' => ['pending_notarization'],
                'pending_notarization' => ['notarized'],
                'notarized' => ['archived', 'distributed'],
            ],
            'legal' => [
                'under_review' => ['corrections_needed', 'approved'],
                'resubmitted' => ['corrections_needed', 'approved'],
            ],
            default => [],
        };

        $from = $submission->status;
        $permittedTargets = $allowed[$from] ?? [];

        if (! in_array($toStatus, $permittedTargets, true)) {
            throw ValidationException::withMessages([
                'status' => ["Transition from {$from} to {$toStatus} is not allowed for {$profile->role_key}."],
            ]);
        }
    }

    private function recordEvent(
        Submission $submission,
        ?string $actorId,
        ?string $fromStatus,
        string $toStatus,
        string $action,
        ?string $notes = null,
        array $metadata = [],
    ): WorkflowEvent {
        return WorkflowEvent::query()->create([
            'submission_id' => $submission->id,
            'actor_id' => $actorId,
            'from_status' => $fromStatus,
            'to_status' => $toStatus,
            'action' => $action,
            'notes' => $notes,
            'metadata' => $metadata,
        ]);
    }

    
    public function generateReviewForm(Profile $profile, Submission $submission): array
    {
        if (! in_array($profile->role_key, ['staff', 'admin'], true)) {
            throw ValidationException::withMessages([
                'role' => ['Only IRO Staff and Admin can generate review forms.'],
            ]);
        }

        return DB::transaction(function () use ($profile, $submission) {
            $formData = [
                'tracking_number' => $submission->tracking_number,
                'office' => $submission->office,
                'department' => $submission->department,
                'partner_institution_name' => $submission->partner_institution_name,
                'agreement_type' => $submission->agreement_type,
                'agreement_title' => $submission->agreement_title,
                'expected_duration' => $submission->expected_duration,
                'partner_contact_email' => $submission->partner_contact_email,
                'contact_person' => $submission->contact_person,
                'contact_position' => $submission->contact_position,
                'contact_email' => $submission->contact_email,
                'contact_number' => $submission->contact_number,
                'requested_completion_date' => $submission->requested_completion_date,
                'urgency_level' => $submission->urgency_level,
                'requested_by_name' => $submission->requested_by_name,
                'requested_by_date' => $submission->requested_by_date,
                'noted_by_name' => $submission->noted_by_name,
                'noted_by_date' => $submission->noted_by_date,
                'date_received' => $submission->date_received,
                'received_by' => $submission->received_by,
                'generated_at' => now()->toIso8601String(),
            ];

            $reviewForm = ReviewForm::query()->create([
                'submission_id' => $submission->id,
                'generated_by' => $profile->id,
                'form_data' => $formData,
            ]);

            $submission->update([
                'status' => 'review_form_generated',
                'review_form_generated_at' => now(),
            ]);

            $this->recordEvent(
                submission: $submission,
                actorId: $profile->id,
                fromStatus: 'logged',
                toStatus: 'review_form_generated',
                action: 'review_form_generated',
                notes: 'Review Form automatically generated after logging.',
            );

            return [
                'review_form' => $reviewForm,
                'submission' => $submission->fresh(['versions', 'workflowEvents']),
            ];
        });
    }

    public function generateNotarizationForm(Profile $profile, Submission $submission): array
    {
        if (! in_array($profile->role_key, ['staff', 'admin'], true)) {
            throw ValidationException::withMessages([
                'role' => ['Only IRO Staff and Admin can generate notarization forms.'],
            ]);
        }

        return DB::transaction(function () use ($profile, $submission) {
            $formData = [
                'tracking_number' => $submission->tracking_number,
                'office' => $submission->office,
                'department' => $submission->department,
                'partner_institution_name' => $submission->partner_institution_name,
                'agreement_type' => $submission->agreement_type,
                'agreement_title' => $submission->agreement_title,
                'signing_date' => $submission->signing_date,
                'signing_mode' => $submission->signing_mode,
                'copies_for_notarization' => $submission->copies_for_notarization,
                'notarial_reference' => $submission->notarial_reference,
                'notarial_date' => $submission->notarial_date,
                'generated_at' => now()->toIso8601String(),
            ];

            $notarizationForm = NotarizationForm::query()->create([
                'submission_id' => $submission->id,
                'generated_by' => $profile->id,
                'form_data' => $formData,
            ]);

            $submission->update([
                'status' => 'notarization_form_generated',
                'notarization_form_generated_at' => now(),
            ]);

            $this->recordEvent(
                submission: $submission,
                actorId: $profile->id,
                fromStatus: 'approved',
                toStatus: 'notarization_form_generated',
                action: 'notarization_form_generated',
                notes: 'Notarization Form automatically generated after legal approval.',
            );

            return [
                'notarization_form' => $notarizationForm,
                'submission' => $submission->fresh(['versions', 'workflowEvents']),
            ];
        });
    }    
    public function recordNotarization(Profile $profile, Submission $submission, array $notarizationData): Submission
    {
        if (! in_array($profile->role_key, ['staff', 'admin'], true)) {
            throw ValidationException::withMessages([
                'role' => ['Only IRO Staff and Admin can record notarization details.'],
            ]);
        }

        return DB::transaction(function () use ($profile, $submission, $notarizationData) {
            $submission->update([
                'notarial_reference' => $notarizationData['notarial_reference'] ?? null,
                'notarial_date' => $notarizationData['notarial_date'] ?? null,
                'signing_date' => $notarizationData['signing_date'] ?? null,
                'signing_mode' => $notarizationData['signing_mode'] ?? 'in_person',
                'copies_for_notarization' => $notarizationData['copies_for_notarization'] ?? 1,
                'status' => 'notarized',
            ]);

            $this->recordEvent(
                submission: $submission,
                actorId: $profile->id,
                fromStatus: 'pending_notarization',
                toStatus: 'notarized',
                action: 'notarization_recorded',
                notes: 'Notarization details recorded by IRO Staff.',
                metadata: $notarizationData,
            );

            return $submission->fresh(['versions', 'workflowEvents']);
        });
    }

    public function archiveSubmission(Profile $profile, Submission $submission): Submission
    {
        if (! in_array($profile->role_key, ['staff', 'admin'], true)) {
            throw ValidationException::withMessages([
                'role' => ['Only IRO Staff and Admin can archive submissions.'],
            ]);
        }

        return DB::transaction(function () use ($profile, $submission) {
            $submission->update([
                'status' => 'archived',
            ]);

            $this->recordEvent(
                submission: $submission,
                actorId: $profile->id,
                fromStatus: 'notarized',
                toStatus: 'archived',
                action: 'submission_archived',
                notes: 'Submission archived after completion.',
            );

            return $submission->fresh(['versions', 'workflowEvents']);
        });
    }

    public function distributeSubmission(Profile $profile, Submission $submission): Submission
    {
        if (! in_array($profile->role_key, ['staff', 'admin'], true)) {
            throw ValidationException::withMessages([
                'role' => ['Only IRO Staff and Admin can distribute submissions.'],
            ]);
        }

        return DB::transaction(function () use ($profile, $submission) {
            $submission->update([
                'status' => 'distributed',
            ]);

            $this->recordEvent(
                submission: $submission,
                actorId: $profile->id,
                fromStatus: 'archived',
                toStatus: 'distributed',
                action: 'submission_distributed',
                notes: 'Submission distributed to stakeholders.',
            );

            return $submission->fresh(['versions', 'workflowEvents']);
        });
    }
    private function generateTrackingNumber(): string
    {
        return 'CTX-'.now()->format('Y').'-'.Str::upper(Str::random(6));
    }
}
