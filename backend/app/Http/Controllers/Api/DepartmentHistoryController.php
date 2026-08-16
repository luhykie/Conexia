<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Document;
use App\Models\DocumentDepartmentReview;
use App\Models\DocumentFile;
use App\Models\DocumentReviewItem;
use App\Models\Profile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class DepartmentHistoryController extends Controller
{
    public function index(Request $request, Document $document): JsonResponse
    {
        $this->participant($request, $document);

        $files = DocumentFile::query()
            ->where('document_id', $document->id)
            ->whereNull('deleted_at')
            ->orderBy('version')
            ->get();
        $filesByVersion = $files->keyBy('version');
        $reviews = DocumentDepartmentReview::query()
            ->where('document_id', $document->id)
            ->get()
            ->keyBy('version');
        $itemsByVersion = DocumentReviewItem::query()
            ->with(['author', 'department'])
            ->where('document_id', $document->id)
            ->where(function ($query) {
                $query->where('type', '!=', 'highlight')->orWhereNull('highlight_removed_at');
            })
            ->oldest()
            ->get()
            ->groupBy('review_version');
        $itemsByFile = $itemsByVersion
            ->flatMap(function ($items, int $reviewVersion) use ($filesByVersion) {
                // New records have document_file_id. Older records use the
                // existing review cycle, whose version is the matching stored
                // document version; never fall back to an arbitrary attachment.
                $reviewFile = $filesByVersion->get($reviewVersion);
                return $items->map(function (DocumentReviewItem $item) use ($reviewFile) {
                    $fileId = $item->document_file_id ?: $reviewFile?->id;
                    return $fileId ? ['file_id' => $fileId, 'item' => $item] : null;
                })->filter();
            })
            ->groupBy('file_id')
            ->map(fn ($entries) => $entries->pluck('item'));

        $logs = AuditLog::query()
            ->with(['actor:id,full_name', 'documentFile:id,document_id,original_filename,version'])
            ->where('document_id', $document->id)
            ->whereIn('action', [
                'department.submission.created',
                'department.review.routed',
                'department.review.correction_requested',
                'department.revision.resubmitted',
                'department.review.approved',
                'document_file.uploaded',
            ])
            ->oldest('created_at')
            ->get();

        $events = $logs->map(fn (AuditLog $log) => $this->row($log, $filesByVersion))->values();
        $actionsByVersion = $logs->filter(fn (AuditLog $log) => isset($log->metadata['review_version']))->groupBy(fn (AuditLog $log) => (int) $log->metadata['review_version']);
        $makeVersion = function (DocumentFile $file, $annotations = null) use ($document, $reviews, $itemsByVersion, $actionsByVersion): array {
            $review = $reviews->get($file->version);
            $actions = $actionsByVersion->get($file->version, collect());
            $returned = $actions->contains(fn (AuditLog $log) => $log->action === 'department.review.correction_requested');
            $status = $review?->approved_at ? 'Approved' : ($returned ? 'Returned for Correction' : ($file->version === $document->department_review_version ? $document->status : 'Previous Version'));

            return [
                'file' => ['id' => $file->id, 'filename' => $file->original_filename, 'version' => $file->version, 'mime_type' => $file->mime_type],
                'label' => sprintf('Version %d — %s', $file->version, $file->version === 1 ? 'Original Submission' : 'Revised Submission'),
                'status' => $status,
                'latest' => $file->version === $document->department_review_version,
                'approved_at' => $review?->approved_at?->toISOString(),
                'annotations' => ($annotations ?? $itemsByVersion->get($file->version, collect()))->map(fn (DocumentReviewItem $item) => $this->item($item))->values(),
            ];
        };
        $versions = $files->map(fn (DocumentFile $file) => $makeVersion($file))->values();

        // These three groups deliberately use only explicit submission/version
        // relationships. There is no "first file" or latest-file fallback.
        $originalFile = $filesByVersion->get(1);
        $original = $originalFile ? $makeVersion($originalFile, collect()) : null;
        $highlightedVersions = $itemsByFile
            ->map(function ($items, string $fileId) use ($files, $makeVersion) {
                $file = $files->firstWhere('id', $fileId);
                return $file ? $makeVersion($file, $items) : null;
            })
            ->filter()
            ->sortBy(fn (array $version) => $version['file']['version'])
            ->values();
        $approvedReview = $reviews->filter(fn (DocumentDepartmentReview $review) => $review->approved_at !== null)->sortByDesc('approved_at')->first();
        $approvedFile = $approvedReview ? $filesByVersion->get($approvedReview->version) : null;
        $approvedDocument = $approvedFile ? $makeVersion($approvedFile) : null;

        Log::debug('Department document history resolved', [
            'submission_id' => $document->id,
            'original_file_id' => $originalFile?->id,
            'highlighted' => $highlightedVersions->map(fn (array $version) => ['version' => $version['file']['version'], 'file_id' => $version['file']['id'], 'annotations' => collect($version['annotations'])->map(fn (array $item) => ['id' => $item['id'], 'text' => $item['selected_text'], 'page' => $item['selection_anchor']['page'] ?? null, 'anchor' => $item['selection_anchor'], 'comment' => $item['comment']])->all()])->all(),
            'approved_version' => $approvedReview?->version,
            'approved_file_id' => $approvedFile?->id,
        ]);

        return response()->json(['success' => true, 'events' => $events, 'versions' => $versions, 'original' => $original, 'highlighted_versions' => $highlightedVersions, 'approved_document' => $approvedDocument]);
    }

    private function row(AuditLog $log, $filesByVersion): array
    {
        $file = $log->documentFile ?: $filesByVersion->get((int) ($log->metadata['review_version'] ?? 0));
        $version = $file?->version;
        $labels = [
            'department.submission.created' => 'Submission created',
            'department.review.routed' => 'Sent to Partner Department',
            'department.review.correction_requested' => 'Correction requested',
            'department.revision.resubmitted' => 'Sent for Partner Re-Review',
            'department.review.approved' => 'Approved',
        ];

        $label = $log->action === 'document_file.uploaded'
            ? sprintf('Version %d — %s Submission', $version, $version === 1 ? 'Original' : 'Revised')
            : ($labels[$log->action] ?? 'Submission updated');

        return [
            'id' => $log->id,
            'label' => $label,
            'actor' => $log->actor?->full_name ?? 'System',
            'created_at' => $log->created_at?->toISOString(),
            'file' => $file ? [
                'id' => $file->id,
                'filename' => $file->original_filename,
                'version' => $version,
                'mime_type' => $file->mime_type,
            ] : null,
        ];
    }

    private function item(DocumentReviewItem $item): array
    {
        return [
            'id' => $item->id,
            'type' => $item->type,
            'document_file_id' => $item->document_file_id,
            'display_number' => $item->display_number,
            'selected_text' => $item->selected_text,
            'selection_anchor' => $item->selection_anchor,
            'highlight_color' => $item->highlight_color,
            'highlight_removed_at' => $item->highlight_removed_at?->toISOString(),
            'comment' => $item->comment,
            'department' => $item->department?->name,
            'author' => $item->author?->full_name,
            'created_at' => $item->created_at?->toISOString(),
        ];
    }

    private function participant(Request $request, Document $document): Profile
    {
        $profile = $request->attributes->get('authenticated_profile');
        if (!$profile || !$profile->department_id || !$document->partner_department_id || !in_array($profile->department_id, [$document->department_id, $document->partner_department_id], true)) {
            abort(403, 'Only participating departments can view this history.');
        }

        if ($profile->department_id === $document->partner_department_id && !$document->department_review_routed_at) {
            abort(403, 'This submission has not been routed to your department.');
        }

        return $profile;
    }
}
