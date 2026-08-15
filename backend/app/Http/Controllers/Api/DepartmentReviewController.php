<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Models\DocumentDepartmentReview;
use App\Models\DocumentReviewItem;
use App\Models\DocumentFile;
use App\Models\AuditLog;
use App\Models\Profile;
use App\Support\DocumentPayload;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class DepartmentReviewController extends Controller
{
    public function show(Request $request, Document $document): JsonResponse
    {
        $this->participant($request, $document);

        // Draft/pre-submission records must never expose review annotations.
        if (!$document->submitted_at) {
            abort(404, 'Review annotations are available after submission.');
        }

        return response()->json([
            'success' => true,
            'document' => DocumentPayload::make($document),
            'reviews' => $this->reviews($document),
            'items' => $this->items($document, $request->attributes->get('authenticated_profile')),
        ]);
    }

    public function storeItem(Request $request, Document $document): JsonResponse
    {
        $profile = $this->participant($request, $document);
        $data = $request->validate([
            'type' => ['required', Rule::in(['highlight'])],
            'document_file_id' => ['nullable', 'uuid'],
            'selected_text' => ['nullable', 'string', 'max:5000'],
            'selection_anchor' => ['nullable', 'array'],
            'highlight_color' => ['nullable', 'string', 'max:32'],
            'comment' => ['nullable', 'string', 'max:5000'],
            'parent_id' => ['nullable', 'uuid', 'exists:document_review_items,id'],
        ]);

        $isPartner = $profile->department_id === $document->partner_department_id;
        if ($document->status === Document::STATUS_DEPARTMENT_REVIEW && !$isPartner) {
            abort(403, 'Only the partner department can annotate while its review is active.');
        }
        if ($document->status !== Document::STATUS_DEPARTMENT_REVIEW) throw ValidationException::withMessages(['status' => 'Review annotations can only be added while the partner department is reviewing.']);

        if (empty($data['selected_text'])) {
            throw ValidationException::withMessages(['selected_text' => 'Select document text before adding a review item.']);
        }
        if (empty(trim((string) ($data['comment'] ?? '')))) throw ValidationException::withMessages(['comment' => 'Please add a comment for this highlighted section.']);
        $data['highlight_color'] = $this->departmentHighlightColor($document, $profile);
        if (!empty($data['parent_id']) && !DocumentReviewItem::query()->whereKey($data['parent_id'])->where('document_id', $document->id)->exists()) {
            abort(404);
        }

        $file = DocumentFile::query()
            ->where('document_id', $document->id)
            ->where('version', $document->department_review_version)
            ->whereNull('deleted_at')
            ->first();

        if (!$file) {
            throw ValidationException::withMessages(['document' => 'The current submitted document version is unavailable for review.']);
        }

        $attributes = [
            ...$data,
            'document_id' => $document->id,
            'review_version' => $document->department_review_version,
            'document_file_id' => $file->id,
            'department_id' => $profile->department_id,
            'author_id' => $profile->id,
        ];

        $item = $data['type'] === 'highlight'
            ? DB::transaction(function () use ($document, $attributes) {
                Document::query()->whereKey($document->id)->lockForUpdate()->firstOrFail();
                $attributes['display_number'] = (int) DocumentReviewItem::query()
                    ->where('document_id', $document->id)
                    ->where('review_version', $document->department_review_version)
                    ->where('type', 'highlight')
                    ->whereNull('highlight_removed_at')
                    ->max('display_number') + 1;

                return DocumentReviewItem::query()->create($attributes);
            })
            : DocumentReviewItem::query()->create($attributes);

        return response()->json(['success' => true, 'item' => $this->item($item)]);
    }

    public function approve(Request $request, Document $document): JsonResponse
    {
        $profile = $this->participant($request, $document);

        $result = DB::transaction(function () use ($document, $profile) {
            $locked = Document::query()->whereKey($document->id)->lockForUpdate()->firstOrFail();
            if ($locked->status !== Document::STATUS_DEPARTMENT_REVIEW) {
                throw ValidationException::withMessages(['status' => 'This submission is not awaiting departmental review.']);
            }
            if ($profile->department_id !== $locked->partner_department_id) {
                abort(403, 'Only the partner department can complete this review.');
            }
            $this->confirmPartnerAnnotations($locked, $profile);
            DocumentDepartmentReview::query()->where('document_id', $locked->id)->where('department_id', $profile->department_id)->where('version', $locked->department_review_version)->update(['approved_at' => now(), 'approved_by' => $profile->id, 'updated_at' => now()]);
            $locked->update(['status' => Document::STATUS_PARTNER_REVIEW_COMPLETE]);
            AuditLog::query()->create(['actor_id' => $profile->id, 'document_id' => $locked->id, 'action' => 'department.review.approved', 'metadata' => ['review_version' => $locked->department_review_version]]);

            return $locked->refresh();
        });

        return response()->json(['success' => true, 'message' => 'Partner review is complete and has been returned to the creator.', 'document' => DocumentPayload::make($result), 'reviews' => $this->reviews($result)]);
    }

    public function updateItem(Request $request, Document $document, string $item): JsonResponse
    {
        $profile = $this->participant($request, $document);
        if ($document->status !== Document::STATUS_DEPARTMENT_REVIEW) {
            throw ValidationException::withMessages(['status' => 'Highlights can only be edited while departmental review is active.']);
        }

        $reviewItem = DocumentReviewItem::query()
            ->whereKey($item)
            ->where('document_id', $document->id)
            ->where('type', 'highlight')
            ->firstOrFail();

        if ($reviewItem->author_id !== $profile->id) {
            abort(403, 'You can only edit your own highlights.');
        }
        if ($profile->department_id !== $document->partner_department_id) abort(403, 'Only the partner department can modify review annotations.');

        $data = $request->validate([
            'highlight_color' => ['nullable', Rule::in(['yellow', 'green', 'blue', 'pink'])],
        ]);

        if (
            ($data['highlight_color'] ?? null) !== null &&
            $data['highlight_color'] !== $this->departmentHighlightColor($document, $profile)
        ) {
            throw ValidationException::withMessages(['highlight_color' => 'Highlights use the color assigned to your department.']);
        }

        $removing = ($data['highlight_color'] ?? null) === null;
        DB::transaction(function () use ($document, $reviewItem, $data, $removing): void {
            Document::query()->whereKey($document->id)->lockForUpdate()->firstOrFail();
            $reviewItem->update([
                'highlight_color' => $data['highlight_color'] ?? null,
                'highlight_removed_at' => $removing ? now() : null,
                'display_number' => $removing ? null : $reviewItem->display_number,
            ]);

            if ($removing) {
                // A removed highlight is not part of the active review. Its
                // highlight-specific discussion must not remain in the active
                // compilation either.
                DocumentReviewItem::query()
                    ->where('document_id', $document->id)
                    ->where('review_version', $document->department_review_version)
                    ->where('parent_id', $reviewItem->id)
                    ->delete();

                $activeHighlights = DocumentReviewItem::query()
                    ->where('document_id', $document->id)
                    ->where('review_version', $document->department_review_version)
                    ->where('type', 'highlight')
                    ->whereNull('highlight_removed_at')
                    ->orderBy('created_at')
                    ->orderBy('id')
                    ->get();

                $activeHighlights->each->update(['display_number' => null]);
                $activeHighlights->values()->each(fn (DocumentReviewItem $item, int $index) =>
                    $item->update(['display_number' => $index + 1])
                );
            }
        });

        return response()->json(['success' => true, 'item' => $this->item($reviewItem->refresh())]);
    }

    public function deleteComment(Request $request, Document $document, string $item): JsonResponse
    {
        $profile = $this->participant($request, $document);
        $comment = DocumentReviewItem::query()
            ->whereKey($item)
            ->where('document_id', $document->id)
            ->where('review_version', $document->department_review_version)
            ->whereIn('type', ['comment', 'reply'])
            ->firstOrFail();

        if ($comment->author_id !== $profile->id) {
            abort(403, 'You can only remove your own comments.');
        }

        $comment->delete();

        return response()->json(['success' => true, 'message' => 'Comment removed.']);
    }

    /** Remove one active annotation by its persistent item ID. */
    public function destroyItem(Request $request, Document $document, string $item): JsonResponse
    {
        $profile = $this->participant($request, $document);

        if (!in_array($document->status, [
            Document::STATUS_DEPARTMENT_REVIEW,
            Document::STATUS_CORRECTIONS_NEEDED,
            Document::STATUS_PARTNER_REVIEW_COMPLETE,
        ], true)) {
            throw ValidationException::withMessages(['status' => 'This review annotation can no longer be removed.']);
        }

        $reviewItem = DocumentReviewItem::query()
            ->whereKey($item)
            ->where('document_id', $document->id)
            ->where('review_version', $document->department_review_version)
            ->firstOrFail();

        if ($reviewItem->author_id !== $profile->id) {
            abort(403, 'You can only remove your own annotations.');
        }
        if ($profile->department_id !== $document->partner_department_id) abort(403, 'Only the partner department can remove review annotations.');

        DB::transaction(function () use ($document, $reviewItem): void {
            Document::query()->whereKey($document->id)->lockForUpdate()->firstOrFail();

            if ($reviewItem->type === 'highlight') {
                $reviewItem->update([
                    'highlight_color' => null,
                    'highlight_removed_at' => now(),
                    'display_number' => null,
                ]);
            } else {
                $reviewItem->delete();
            }

            // Remove only the comment/reply thread attached to this item.
            $parentIds = [$reviewItem->id];
            while ($parentIds !== []) {
                $childIds = DocumentReviewItem::query()
                    ->where('document_id', $document->id)
                    ->where('review_version', $document->department_review_version)
                    ->whereIn('parent_id', $parentIds)
                    ->pluck('id')
                    ->all();

                if ($childIds === []) break;

                DocumentReviewItem::query()->whereIn('id', $childIds)->delete();
                $parentIds = $childIds;
            }

            $this->renumberActiveHighlights($document);
        });

        return response()->json(['success' => true, 'message' => 'Annotation removed.']);
    }

    public function requestCorrection(Request $request, Document $document): JsonResponse
    {
        $profile = $this->participant($request, $document);
        if ($document->status !== Document::STATUS_DEPARTMENT_REVIEW) {
            throw ValidationException::withMessages(['status' => 'Corrections can only be requested during departmental review.']);
        }
        if ($profile->department_id !== $document->partner_department_id) abort(403, 'Only the partner department can request corrections.');
        $data = $request->validate(['comment' => ['required', 'string', 'max:5000']]);
        $this->confirmPartnerAnnotations($document, $profile);
        $document->update(['status' => Document::STATUS_CORRECTIONS_NEEDED]);
        AuditLog::query()->create(['actor_id' => $profile->id, 'document_id' => $document->id, 'action' => 'department.review.correction_requested', 'metadata' => ['review_version' => $document->department_review_version]]);
        DocumentReviewItem::query()->create(['document_id' => $document->id, 'review_version' => $document->department_review_version, 'department_id' => $profile->department_id, 'author_id' => $profile->id, 'type' => 'comment', 'comment' => $data['comment'], 'confirmed_at' => now()]);

        return response()->json(['success' => true, 'message' => 'Correction requested. A revised document will require new approvals from both departments.']);
    }

    public function routeToStaff(Request $request, Document $document): JsonResponse
    {
        $profile = $this->participant($request, $document);
        if ($profile->department_id !== $document->department_id) abort(403, 'Only the creator can route this submission to Staff Review.');
        if ($document->status !== Document::STATUS_PARTNER_REVIEW_COMPLETE) throw ValidationException::withMessages(['status' => 'Partner approval is required before routing to Staff Review.']);

        $document->update(['status' => Document::STATUS_SUBMITTED]);
        return response()->json(['success' => true, 'message' => 'Submission routed to Staff Review.', 'document' => DocumentPayload::make($document->refresh())]);
    }

    private function participant(Request $request, Document $document): Profile
    {
        $profile = $request->attributes->get('authenticated_profile');
        if (!$profile || !$profile->department_id || !$document->partner_department_id || !in_array($profile->department_id, [$document->department_id, $document->partner_department_id], true)) abort(403, 'Only participating departments can review this submission.');

        if (
            $profile->department_id === $document->partner_department_id &&
            !$document->department_review_routed_at
        ) {
            abort(403, 'This submission has not yet been routed to your department.');
        }

        return $profile;
    }

    private function departmentHighlightColor(Document $document, Profile $profile): string
    {
        return $profile->department_id === $document->department_id
            ? 'yellow'
            : 'blue';
    }

    private function reviews(Document $document): array
    {
        return DocumentDepartmentReview::query()->with('department')->where('document_id', $document->id)->where('version', $document->department_review_version)->get()->map(fn ($review) => ['department_id' => $review->department_id, 'department' => $review->department?->name, 'approved_at' => $review->approved_at?->toISOString()])->all();
    }

    private function renumberActiveHighlights(Document $document): void
    {
        $activeHighlights = DocumentReviewItem::query()
            ->where('document_id', $document->id)
            ->where('review_version', $document->department_review_version)
            ->where('type', 'highlight')
            ->whereNull('highlight_removed_at')
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        // Clear numbers first so the active-number unique index cannot collide
        // while an item moves to an earlier display number.
        $activeHighlights->each->update(['display_number' => null]);
        $activeHighlights->values()->each(fn (DocumentReviewItem $item, int $index) =>
            $item->update(['display_number' => $index + 1])
        );
    }

    private function confirmPartnerAnnotations(Document $document, Profile $profile): void
    {
        DocumentReviewItem::query()
            ->where('document_id', $document->id)
            ->where('review_version', $document->department_review_version)
            ->where('department_id', $profile->department_id)
            ->whereNull('confirmed_at')
            ->update(['confirmed_at' => now()]);
    }

    private function items(Document $document, ?Profile $profile): array
    {
        return DocumentReviewItem::query()->with(['author', 'department'])
            ->where('document_id', $document->id)
            ->where('review_version', $document->department_review_version)
            ->where(function ($query) { $query->where('type', '!=', 'highlight')->orWhereNull('highlight_removed_at'); })
            ->where(function ($query) use ($profile) {
                $query->whereNotNull('confirmed_at');
                if ($profile?->department_id) $query->orWhere('department_id', $profile->department_id);
            })
            ->oldest()->get()->map(fn ($item) => $this->item($item))->all();
    }
    private function item(DocumentReviewItem $item): array { $item->loadMissing(['author', 'department']); return ['id' => $item->id, 'type' => $item->type, 'parent_id' => $item->parent_id, 'review_version' => $item->review_version, 'display_number' => $item->display_number, 'selected_text' => $item->selected_text, 'selection_anchor' => $item->selection_anchor, 'highlight_color' => $item->highlight_color, 'highlight_removed_at' => $item->highlight_removed_at?->toISOString(), 'confirmed_at' => $item->confirmed_at?->toISOString(), 'comment' => $item->comment, 'department' => $item->department?->name, 'author' => $item->author?->full_name, 'created_at' => $item->created_at?->toISOString()]; }
}
