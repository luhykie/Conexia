<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Models\ReviewForm;
use App\Models\WorkflowEvent;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReviewFormController extends Controller
{
    public function __construct(
        private readonly NotificationService $notifications
    ) {
    }

    private const CHECKLIST_KEYS = [
        'signatures',
        'terms',
        'attachments',
        'gdpr',
    ];

    public function show(Request $request, Document $document): JsonResponse
    {
        $this->ensureCanAccess($request, $document);

        return response()->json([
            'data' => $document->reviewForm()
                ->with($this->relationships())
                ->first(),
        ]);
    }

    public function save(Request $request, Document $document): JsonResponse
    {
        $this->ensureCanPrepare($request, $document);
        $validated = $this->validateForm($request);
        $profile = $this->profile($request);

        $form = DB::transaction(function () use ($document, $validated, $profile): ReviewForm {
            $form = $document->reviewForm()->firstOrNew();
            $isNewForm = ! $form->exists;

            if ($form->exists && $form->review_form_status === 'validated') {
                abort(422, 'A validated Review Form cannot be edited.');
            }

            $form->fill([
                ...$validated,
                'prepared_by' => $profile->id,
                'review_form_status' => 'draft',
                'submitted_at' => null,
                'validated_by' => null,
                'validated_at' => null,
            ]);
            if ($isNewForm && ! array_key_exists('checklist_answers', $validated)) {
                $form->checklist_answers = array_fill_keys(self::CHECKLIST_KEYS, false);
            }
            $form->save();

            if (
                $profile->role === 'iro_staff'
                && ! $document->assigned_iro_staff
            ) {
                $document->update([
                    'assigned_iro_staff' => $profile->id,
                    'updated_at' => now(),
                ]);
            }

            return $form;
        });

        return response()->json([
            'message' => 'Review Form draft saved.',
            'data' => $form->fresh($this->relationships()),
        ]);
    }

    public function submit(Request $request, Document $document): JsonResponse
    {
        $this->ensureCanPrepare($request, $document);
        $validated = $this->validateForm($request);
        $profile = $this->profile($request);

        $form = DB::transaction(function () use ($document, $validated, $profile, $request): ReviewForm {
            $lockedDocument = Document::query()->lockForUpdate()->findOrFail($document->id);

            if (! in_array($lockedDocument->status, ['Submitted', 'Logged', 'Review Form Sent Back'], true)) {
                abort(422, 'This document is not awaiting Review Form submission.');
            }

            $form = ReviewForm::query()->firstOrNew(['document_id' => $lockedDocument->id]);
            $isNewForm = ! $form->exists;
            if ($form->exists && $form->review_form_status === 'validated') {
                abort(422, 'A validated Review Form cannot be resubmitted.');
            }

            $form->fill([
                ...$validated,
                'prepared_by' => $profile->id,
                'review_form_status' => 'submitted',
                'submitted_at' => now(),
                'validated_by' => null,
                'validated_at' => null,
            ]);
            if ($isNewForm && ! array_key_exists('checklist_answers', $validated)) {
                $form->checklist_answers = array_fill_keys(self::CHECKLIST_KEYS, false);
            }
            $form->save();

            $previousStatus = $lockedDocument->status;
            $documentUpdates = [
                'status' => 'Review Form Submitted',
                'updated_at' => now(),
            ];
            if ($profile->role === 'iro_staff') {
                $documentUpdates['assigned_iro_staff'] = $profile->id;
            }
            $lockedDocument->update($documentUpdates);
            $this->recordEvent($request, $lockedDocument, 'review_form_submitted', $previousStatus, 'Review Form Submitted');
            $this->notifications->documentLogged($lockedDocument, $profile);

            return $form;
        });

        return response()->json([
            'message' => 'Review Form submitted to IRO Admin.',
            'data' => $form->fresh($this->relationships()),
        ]);
    }

    public function validateReview(Request $request, Document $document): JsonResponse
    {
        $validated = $request->validate([
            'admin_remarks' => ['nullable', 'string', 'max:5000'],
            'checklist_answers' => ['required', 'array'],
            'checklist_answers.signatures' => ['required', 'boolean'],
            'checklist_answers.terms' => ['required', 'boolean'],
            'checklist_answers.attachments' => ['required', 'boolean'],
            'checklist_answers.gdpr' => ['required', 'boolean'],
        ]);
        $profile = $this->profile($request);

        $form = DB::transaction(function () use ($document, $validated, $profile, $request): ReviewForm {
            $lockedDocument = Document::query()->lockForUpdate()->findOrFail($document->id);
            $form = ReviewForm::query()->where('document_id', $lockedDocument->id)->lockForUpdate()->first();

            if (! $form || $form->review_form_status !== 'submitted') {
                abort(422, 'A submitted Review Form is required for validation.');
            }

            if (collect(self::CHECKLIST_KEYS)->contains(
                fn (string $key): bool => ($validated['checklist_answers'][$key] ?? false) !== true
            )) {
                abort(422, 'Every Review Form checklist item must be complete before validation.');
            }

            $form->update([
                'checklist_answers' => $validated['checklist_answers'],
                'review_form_status' => 'validated',
                'admin_remarks' => $validated['admin_remarks'] ?? null,
                'validated_by' => $profile->id,
                'validated_at' => now(),
            ]);
            $previousStatus = $lockedDocument->status;
            $lockedDocument->update([
                'status' => 'Admin Validated',
                'updated_at' => now(),
            ]);
            $this->recordEvent($request, $lockedDocument, 'review_form_validated', $previousStatus, 'Admin Validated');

            return $form;
        });

        return response()->json([
            'message' => 'Review Form validated.',
            'data' => $form->fresh($this->relationships()),
        ]);
    }

    public function sendBack(Request $request, Document $document): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:5000'],
            'admin_remarks' => ['nullable', 'string', 'max:5000'],
        ]);
        $profile = $this->profile($request);

        $form = DB::transaction(function () use ($document, $validated, $profile, $request): ReviewForm {
            $lockedDocument = Document::query()->lockForUpdate()->findOrFail($document->id);
            $form = ReviewForm::query()->where('document_id', $lockedDocument->id)->lockForUpdate()->first();

            if (! $form || $form->review_form_status !== 'submitted') {
                abort(422, 'Only a submitted Review Form can be sent back.');
            }

            $form->update([
                'review_form_status' => 'sent_back',
                'admin_remarks' => $validated['admin_remarks'] ?? null,
                'sent_back_reason' => $validated['reason'],
                'sent_back_by' => $profile->id,
                'sent_back_at' => now(),
                'validated_by' => null,
                'validated_at' => null,
            ]);
            $previousStatus = $lockedDocument->status;
            $lockedDocument->update([
                'status' => 'Review Form Sent Back',
                'updated_at' => now(),
            ]);
            $this->recordEvent($request, $lockedDocument, 'review_form_sent_back', $previousStatus, 'Review Form Sent Back', $validated['reason']);

            return $form;
        });

        return response()->json([
            'message' => 'Review Form sent back to IRO Staff.',
            'data' => $form->fresh($this->relationships()),
        ]);
    }

    private function validateForm(Request $request): array
    {
        $rules = [
            'staff_remarks' => ['nullable', 'string', 'max:5000'],
        ];

        if ($this->profile($request)->role !== 'iro_staff') {
            $rules += [
            'checklist_answers' => ['required', 'array'],
            'checklist_answers.signatures' => ['required', 'boolean'],
            'checklist_answers.terms' => ['required', 'boolean'],
            'checklist_answers.attachments' => ['required', 'boolean'],
            'checklist_answers.gdpr' => ['required', 'boolean'],
            ];
        }

        return $request->validate($rules);
    }

    private function ensureCanAccess(Request $request, Document $document): void
    {
        $profile = $this->profile($request);
        $allowed = $profile->role === 'iro_admin'
            || (
                $profile->role === 'legal_counsel'
                && $document->assigned_legal_counsel === $profile->id
            )
            || (
                $profile->role === 'iro_staff'
                && (
                    $document->assigned_iro_staff === $profile->id
                    || $document->status === 'Submitted'
                )
            );

        if (! $allowed) {
            abort(404);
        }
    }

    private function ensureCanPrepare(Request $request, Document $document): void
    {
        $profile = $this->profile($request);
        if (
            ! in_array($profile->role, ['iro_staff', 'iro_admin'], true)
            || (
                $profile->role === 'iro_staff'
                && $document->assigned_iro_staff
                && $document->assigned_iro_staff !== $profile->id
            )
        ) {
            abort(404);
        }
    }

    private function profile(Request $request): object
    {
        return $request->attributes->get('auth_profile');
    }

    private function relationships(): array
    {
        return [
            'preparer:id,full_name,email',
            'validator:id,full_name,email',
            'sentBackBy:id,full_name,email',
        ];
    }

    private function recordEvent(
        Request $request,
        Document $document,
        string $eventType,
        ?string $fromStatus,
        string $toStatus,
        ?string $notes = null
    ): void {
        $profile = $this->profile($request);
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
