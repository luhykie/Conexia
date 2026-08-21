<?php

namespace App\Services;

use App\Models\Document;
use App\Models\AuditLog;
use App\Models\Profile;
use App\Repositories\LegalCounselRepository;
use App\Support\Pagination;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class LegalCounselService
{
    public function __construct(
        private readonly LegalCounselRepository $documents
    ) {
    }

    public function reviewDocuments(
        Profile $legalCounsel,
        array $options
    ): array
    {
        $documents = $this->documents
            ->reviewDocuments($legalCounsel, $options);

        return [
            'items' => $documents
            ->map(fn (Document $document): array =>
                $this->documents->toArray($document)
            )
            ->values()
            ->all(),
            'meta' => Pagination::meta($documents),
        ];
    }

    public function submitDecision(
        Profile $legalCounsel,
        string $documentId,
        array $data
    ): array {
        return DB::transaction(function () use (
            $legalCounsel,
            $documentId,
            $data
        ): array {
            $document = $this->findDocument(
                $documentId,
                $legalCounsel
            );

            if (
                $document->status !==
                Document::STATUS_UNDER_LEGAL_REVIEW
            ) {
                throw ValidationException::withMessages([
                    'status' => 'Only documents under legal review can be decided.',
                ]);
            }

            // A correction decision must return to IRO Admin first. IRO Admin
            // explicitly releases it to the originating department.
            $previousStatus = $document->status;
            $correctionRequested =
                $data['status'] === Document::STATUS_CORRECTIONS_NEEDED;
            $document->status = $correctionRequested
                ? Document::STATUS_CORRECTION_REQUIRED
                : $data['status'];
            $document->legal_notes =
                $data['legal_notes'] ?? null;

            $document = $this->documents->save($document);

            if ($correctionRequested) {
                AuditLog::query()->create([
                    'actor_id' => $legalCounsel->id,
                    'document_id' => $document->id,
                    'action' => 'legal.review.correction_requested',
                    'metadata' => [
                        'legal_notes' => $document->legal_notes,
                        'previous_status' => $previousStatus,
                        'new_status' => Document::STATUS_CORRECTION_REQUIRED,
                    ],
                ]);
            }

            return $this->documents->toArray(
                $document
            );
        });
    }

    public function notarizationDocuments(
        Profile $legalCounsel,
        array $options
    ): array {
        $documents = $this->documents
            ->notarizationDocuments($legalCounsel, $options);

        return [
            'items' => $documents
            ->map(fn (Document $document): array =>
                $this->documents->toArray($document)
            )
            ->values()
            ->all(),
            'meta' => Pagination::meta($documents),
        ];
    }

    public function submitForNotarization(
        Profile $legalCounsel,
        string $documentId,
        array $data
    ): array {
        return DB::transaction(function () use (
            $legalCounsel,
            $documentId,
            $data
        ): array {
            $document = $this->findDocument(
                $documentId,
                $legalCounsel
            );

            if (
                $document->status !==
                Document::STATUS_APPROVED
            ) {
                throw ValidationException::withMessages([
                    'status' => 'Only approved documents can be submitted for notarization.',
                ]);
            }

            $this->applyNotarizationData($document, $data);
            $document->status =
                Document::STATUS_PENDING_NOTARIZATION;

            return $this->documents->toArray(
                $this->documents->save($document)
            );
        });
    }

    public function completeNotarization(
        Profile $legalCounsel,
        string $documentId,
        array $data
    ): array {
        return DB::transaction(function () use (
            $legalCounsel,
            $documentId,
            $data
        ): array {
            $document = $this->findDocument(
                $documentId,
                $legalCounsel
            );

            if (
                $document->status !==
                Document::STATUS_PENDING_NOTARIZATION
            ) {
                throw ValidationException::withMessages([
                    'status' => 'Only pending notarization documents can be completed.',
                ]);
            }

            $this->applyNotarizationData($document, $data);
            $document->status = Document::STATUS_NOTARIZED;

            return $this->documents->toArray(
                $this->documents->save($document)
            );
        });
    }

    public function history(
        Profile $legalCounsel,
        array $options
    ): array
    {
        $documents = $this->documents
            ->legalHistory($legalCounsel, $options);

        return [
            'items' => $documents
            ->map(fn (Document $document): array =>
                $this->historyItem($document)
            )
            ->values()
            ->all(),
            'meta' => Pagination::meta($documents),
        ];
    }

    private function findDocument(
        string $documentId,
        Profile $legalCounsel
    ): Document {
        $document =
            $this->documents->findAssignedDocumentForUpdate(
                $documentId,
                $legalCounsel
            );

        if (!$document) {
            throw (new ModelNotFoundException())
                ->setModel(Document::class, [$documentId]);
        }

        return $document;
    }

    private function applyNotarizationData(
        Document $document,
        array $data
    ): void {
        $document->notarial_reference_number =
            $data['notarial_reference_number'];
        $document->notarization_date =
            $data['notarization_date'];
        $document->notary_signature_code =
            $data['notary_signature_code'];
    }

    private function historyItem(Document $document): array
    {
        $trackingNumber =
            $document->tracking_number ?? 'Untracked document';
        $correction = $document->latestLegalCorrection;

        if ($correction) {
            return [
                'title' => "Correction Required #{$trackingNumber}",
                'detail' => $correction->metadata['legal_notes']
                    ?? 'Legal Counsel requested corrections.',
                'status' => 'Correction',
                'document_id' => $document->id,
                'tracking_number' => $document->tracking_number,
                'updated_at' => $correction->created_at?->toISOString(),
            ];
        }

        return [
            'title' => "{$document->status} #{$trackingNumber}",
            'detail' => $document->legal_notes
                ?: "{$document->title} was updated by Legal Counsel.",
            'status' => $this->historyBadge($document->status),
            'document_id' => $document->id,
            'tracking_number' => $document->tracking_number,
            'updated_at' =>
                $document->updated_at?->toISOString(),
        ];
    }

    private function historyBadge(string $status): string
    {
        return match ($status) {
            Document::STATUS_CORRECTION_REQUIRED,
            Document::STATUS_CORRECTIONS_NEEDED => 'Correction',
            Document::STATUS_APPROVED => 'Verified',
            Document::STATUS_PENDING_NOTARIZATION => 'Pending',
            Document::STATUS_NOTARIZED => 'Recorded',
            Document::STATUS_ARCHIVED => 'Archived',
            default => 'Recorded',
        };
    }
}
