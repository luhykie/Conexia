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
use Illuminate\Support\Facades\Gate;

class DepartmentHistoryController extends Controller
{
    private const SUBMISSION_ACTIVITY_ACTIONS = [
        'department.submission.created',
        'iro_admin.document.created',
        'document_file.uploaded',
        'department.review.routed',
        'department.review.correction_requested',
        'department.revision.resubmitted',
        'department.review.approved',
        'iro_staff.document.forwarded_to_admin',
        'iro_staff.document.returned_for_correction',
        'iro_admin.document.logged',
        'iro_admin.document.assigned_to_legal',
        'iro_admin.review.returned_for_revision',
        'iro_admin.review.validated_and_routed_to_legal',
        'iro_admin.legal_correction.routed_to_department',
        'iro_admin.document.reassigned',
        'legal.review.correction_requested',
        'legal.review.approved',
        'document_renewal.requested',
        'iro_admin.document.archived',
        'iro_admin.document.unarchived',
    ];

    public function history(Request $request, Document $document): JsonResponse
    {
        $profile = $request->attributes->get('authenticated_profile');

        return $profile?->role === Profile::ROLE_IRO_STAFF
            ? $this->activity($request, $document)
            : $this->index($request, $document);
    }

    public function index(Request $request, Document $document): JsonResponse
    {
        $this->detailedHistoryViewer($request, $document);

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
            ->with(['actor:id,full_name,role', 'documentFile:id,document_id,original_filename,version,mime_type'])
            ->where('document_id', $document->id)
            ->whereNotIn('action', [
                'document_file.annotated',
                'document_file.annotation_comment_updated',
                'document_file.annotation_removed',
            ])
            ->oldest('created_at')
            ->get();

        $fileAnnotations = $this->fileAnnotations($document);
        $itemsByFile = $itemsByFile->map(function ($items, $fileId) use ($fileAnnotations) {
            return $items->concat($fileAnnotations->get($fileId, collect()));
        });
        $fileAnnotations->each(function ($items, $fileId) use (&$itemsByFile) {
            if (!$itemsByFile->has($fileId)) {
                $itemsByFile->put($fileId, $items);
            }
        });

        $events = $logs->map(fn (AuditLog $log) => $this->row($log, $filesByVersion))->values();
        $actionsByVersion = $logs->filter(fn (AuditLog $log) => isset($log->metadata['review_version']))->groupBy(fn (AuditLog $log) => (int) $log->metadata['review_version']);
        $makeVersion = function (DocumentFile $file, $annotations = null) use ($document, $reviews, $itemsByFile, $actionsByVersion): array {
            $review = $reviews->get($file->version);
            $actions = $actionsByVersion->get($file->version, collect());
            $returned = $actions->contains(fn (AuditLog $log) => $log->action === 'department.review.correction_requested');
            $status = $review?->approved_at ? 'Approved' : ($returned ? 'Returned for Correction' : ($file->version === $document->department_review_version ? $document->status : 'Previous Version'));

            return [
                'file' => ['id' => $file->id, 'filename' => $file->original_filename, 'version' => $file->version, 'mime_type' => $file->mime_type, 'created_at' => $file->created_at?->toISOString()],
                'label' => sprintf('Version %d — %s', $file->version, $file->version === 1 ? 'Original Submission' : 'Revised Submission'),
                'status' => $status,
                'latest' => $file->version === $document->department_review_version,
                'approved_at' => $review?->approved_at?->toISOString(),
                'annotations' => ($annotations ?? $itemsByFile->get($file->id, collect()))
                    ->map(fn ($item) => is_array($item) ? $item : $this->item($item))->values(),
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
        $approvedLog = $logs->whereIn('action', ['legal.review.approved', 'department.review.approved'])
            ->sortByDesc('created_at')->first();
        $approvedVersion = $approvedReview?->version
            ?? $approvedLog?->documentFile?->version
            ?? ($approvedLog?->metadata['document_version'] ?? $approvedLog?->metadata['review_version'] ?? null);
        $approvedFile = $approvedVersion ? $filesByVersion->get((int) $approvedVersion) : null;
        $approvedDocument = $approvedFile ? $makeVersion($approvedFile) : null;
        if ($approvedDocument) {
            $approvedDocument['approved_at'] = $approvedReview?->approved_at?->toISOString()
                ?? $approvedLog?->created_at?->toISOString();
            $approvedDocument['approved_version'] = (int) $approvedVersion;
        }

        Log::debug('Department document history resolved', [
            'submission_id' => $document->id,
            'original_file_id' => $originalFile?->id,
            'highlighted' => $highlightedVersions->map(fn (array $version) => ['version' => $version['file']['version'], 'file_id' => $version['file']['id'], 'annotations' => collect($version['annotations'])->map(fn (array $item) => ['id' => $item['id'], 'text' => $item['selected_text'], 'page' => $item['selection_anchor']['page'] ?? null, 'anchor' => $item['selection_anchor'], 'comment' => $item['comment']])->all()])->all(),
            'approved_version' => $approvedVersion,
            'approved_file_id' => $approvedFile?->id,
        ]);

        return response()->json(['success' => true, 'events' => $events, 'versions' => $versions, 'original' => $original, 'highlighted_versions' => $highlightedVersions, 'approved_document' => $approvedDocument]);
    }

    private function activity(Request $request, Document $document): JsonResponse
    {
        $profile = $request->attributes->get('authenticated_profile');
        abort_unless($profile?->role === Profile::ROLE_IRO_STAFF, 403);

        $events = AuditLog::query()
            ->with(['actor:id,full_name,role', 'documentFile:id,document_id,version'])
            ->where('document_id', $document->id)
            ->whereIn('action', self::SUBMISSION_ACTIVITY_ACTIONS)
            ->oldest('created_at')
            ->get()
            ->map(fn (AuditLog $log) => $this->activityRow($log))
            ->values();

        return response()->json(['success' => true, 'events' => $events]);
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
            'actor_role' => $log->actor?->role,
            'created_at' => $log->created_at?->toISOString(),
            'previous_status' => $log->metadata['previous_status'] ?? null,
            'new_status' => $log->metadata['new_status'] ?? null,
            'destination' => $log->metadata['destination'] ?? $log->metadata['new_destination'] ?? null,
            'reason' => $log->metadata['reason'] ?? $log->metadata['remarks'] ?? $log->metadata['legal_notes'] ?? null,
            'file' => $file ? [
                'id' => $file->id,
                'filename' => $file->original_filename,
                'version' => $version,
                'mime_type' => $file->mime_type,
            ] : null,
        ];
    }

    private function activityRow(AuditLog $log): array
    {
        $metadata = $log->metadata ?? [];
        $version = $log->documentFile?->version
            ?? $metadata['document_version']
            ?? $metadata['review_version']
            ?? null;

        return [
            'id' => $log->id,
            'action' => $log->action,
            'label' => $this->actionLabel($log->action, $version),
            'actor' => $log->actor?->full_name ?? 'System',
            'actor_role' => $log->actor?->role ?? ($metadata['actor']['role'] ?? null),
            'created_at' => $log->created_at?->toISOString(),
            'version' => $version ? (int) $version : null,
            'previous_status' => $metadata['previous_status'] ?? null,
            'new_status' => $metadata['new_status'] ?? null,
            'destination' => $metadata['destination'] ?? $metadata['new_destination'] ?? null,
            'reason' => $metadata['reason'] ?? $metadata['remarks'] ?? $metadata['legal_notes'] ?? null,
        ];
    }

    private function actionLabel(string $action, ?int $version): string
    {
        if ($action === 'document_file.uploaded') {
            return $version ? sprintf('Version %d submitted', $version) : 'Document submitted';
        }

        return match ($action) {
            'department.submission.created', 'iro_admin.document.created' => 'Submission created',
            'department.review.routed' => 'Routed for department review',
            'department.review.correction_requested', 'legal.review.correction_requested',
            'iro_staff.document.returned_for_correction', 'iro_admin.review.returned_for_revision' => 'Correction requested',
            'department.revision.resubmitted' => 'Revision submitted',
            'iro_staff.document.forwarded_to_admin' => 'Routed to IRO Admin',
            'iro_admin.review.validated_and_routed_to_legal' => 'Routed to Legal Counsel',
            'iro_admin.legal_correction.routed_to_department' => 'Routed to Department',
            'department.review.approved', 'legal.review.approved' => 'Approved',
            'iro_admin.document.reassigned' => 'Rerouted',
            'iro_admin.document.unarchived' => 'Unarchived',
            default => str($action)->afterLast('.')
                ->replace('_', ' ')->title()->toString(),
        };
    }

    private function fileAnnotations(Document $document)
    {
        $events = AuditLog::query()
            ->with('actor:id,full_name,role')
            ->where('document_id', $document->id)
            ->whereNotNull('document_file_id')
            ->whereIn('action', [
                'document_file.annotated',
                'document_file.annotation_comment_updated',
                'document_file.annotation_removed',
            ])
            ->oldest('created_at')
            ->get();
        $changes = $events->whereIn('action', [
            'document_file.annotation_comment_updated',
            'document_file.annotation_removed',
        ])->groupBy(fn (AuditLog $event) => $event->metadata['annotation_id'] ?? '');

        return $events->where('action', 'document_file.annotated')
            ->reject(fn (AuditLog $annotation) => $changes->get($annotation->id, collect())
                ->contains(fn (AuditLog $event) => $event->action === 'document_file.annotation_removed'))
            ->map(function (AuditLog $annotation) use ($changes): array {
                $update = $changes->get($annotation->id, collect())
                    ->where('action', 'document_file.annotation_comment_updated')->last();
                return [
                    'id' => $annotation->id,
                    'type' => 'highlight',
                    'document_file_id' => $annotation->document_file_id,
                    'display_number' => null,
                    'selected_text' => $annotation->metadata['highlight'] ?? '',
                    'selection_anchor' => $annotation->metadata['geometry'] ?? null,
                    'geometry_units' => 'normalized',
                    'highlight_color' => 'yellow',
                    'highlight_removed_at' => null,
                    'comment' => $update?->metadata['new_comment'] ?? $annotation->metadata['comment'] ?? '',
                    'department' => null,
                    'author' => $annotation->actor?->full_name,
                    'actor_role' => $annotation->actor?->role,
                    'created_at' => $annotation->created_at?->toISOString(),
                ];
            })->groupBy('document_file_id');
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
            'geometry_units' => 'department_review_pixels',
            'highlight_color' => $item->highlight_color,
            'highlight_removed_at' => $item->highlight_removed_at?->toISOString(),
            'comment' => $item->comment,
            'department' => $item->department?->name,
            'author' => $item->author?->full_name,
            'created_at' => $item->created_at?->toISOString(),
        ];
    }

    private function detailedHistoryViewer(Request $request, Document $document): Profile
    {
        $profile = $request->attributes->get('authenticated_profile');
        if ($profile && in_array($profile->role, [Profile::ROLE_IRO_ADMIN, Profile::ROLE_LEGAL_COUNSEL], true)) {
            abort_unless(Gate::forUser($profile)->allows('view-document-metadata', $document), 404);
            return $profile;
        }
        if (!$profile || $profile->role !== Profile::ROLE_DEPARTMENT_STAFF || !$profile->department_id || !in_array($profile->department_id, array_filter([$document->department_id, $document->partner_department_id]), true)) {
            abort(403, 'Only participating departments can view this history.');
        }

        if ($profile->department_id === $document->partner_department_id && !$document->department_review_routed_at) {
            abort(403, 'This submission has not been routed to your department.');
        }

        return $profile;
    }
}
