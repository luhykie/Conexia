<?php

namespace App\Repositories;

use App\Models\Document;
use App\Models\Profile;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use App\Support\Pagination;

class LegalCounselRepository
{
    public function reviewDocuments(
        Profile $legalCounsel,
        array $options
    ): LengthAwarePaginator
    {
        return $this->assignedDocuments($legalCounsel)
            ->where(
                'status',
                Document::STATUS_UNDER_LEGAL_REVIEW
            )
            ->tap(fn ($query) => $this->applyListOptions($query, $options))
            ->paginate(
                $options['per_page'],
                ['*'],
                'page',
                $options['page']
            );
    }

    public function notarizationDocuments(
        Profile $legalCounsel,
        array $options
    ): LengthAwarePaginator {
        return $this->assignedDocuments($legalCounsel)
            ->whereIn('status', [
                Document::STATUS_APPROVED,
                Document::STATUS_PENDING_NOTARIZATION,
                Document::STATUS_NOTARIZED,
            ])
            ->tap(fn ($query) => $this->applyListOptions($query, $options))
            ->paginate(
                $options['per_page'],
                ['*'],
                'page',
                $options['page']
            );
    }

    public function legalHistory(
        Profile $legalCounsel,
        array $options
    ): LengthAwarePaginator
    {
        return $this->assignedDocuments($legalCounsel)
            ->whereIn('status', [
                Document::STATUS_CORRECTIONS_NEEDED,
                Document::STATUS_APPROVED,
                Document::STATUS_PENDING_NOTARIZATION,
                Document::STATUS_NOTARIZED,
                Document::STATUS_ARCHIVED,
            ])
            ->tap(fn ($query) => $this->applyListOptions($query, $options))
            ->paginate(
                $options['per_page'],
                ['*'],
                'page',
                $options['page']
            );
    }

    public function findAssignedDocumentForUpdate(
        string $documentId,
        Profile $legalCounsel
    ): ?Document {
        return Document::query()
            ->whereKey($documentId)
            ->where(
                'assigned_legal_counsel',
                $legalCounsel->id
            )
            ->lockForUpdate()
            ->first();
    }

    public function save(Document $document): Document
    {
        $document->save();

        return $document->refresh();
    }

    public function toArray(Document $document): array
    {
        $document->loadMissing([
            'department',
            'submitter',
            'legalCounsel',
        ]);

        return [
            'id' => $document->id,
            'tracking_number' => $document->tracking_number,
            'title' => $document->title,
            'document_type' => $document->document_type,
            'partner_institution' => $document->partner_institution,
            'partner_email' => $document->partner_email,
            'description' => $document->description,
            'department_id' => $document->department_id,
            'department' => $document->department
                ? [
                    'id' => $document->department->id,
                    'name' => $document->department->name,
                    'code' => $document->department->code,
                ]
                : null,
            'submitted_by' => $document->submitted_by,
            'assigned_legal_counsel' =>
                $document->assigned_legal_counsel,
            'status' => $document->status,
            'legal_notes' => $document->legal_notes,
            'notarial_reference_number' =>
                $document->notarial_reference_number,
            'notarization_date' =>
                $document->notarization_date?->toDateString(),
            'notary_signature_code' =>
                $document->notary_signature_code,
            'submitted_at' =>
                $document->submitted_at?->toISOString(),
            'updated_at' =>
                $document->updated_at?->toISOString(),
        ];
    }

    private function assignedDocuments(Profile $legalCounsel)
    {
        return Document::query()
            ->with([
                'department',
                'submitter',
                'legalCounsel',
            ])
            ->where(
                'assigned_legal_counsel',
                $legalCounsel->id
            )
            ->orderByDesc('updated_at');
    }

    private function applyListOptions($query, array $options): void
    {
        if (($options['search'] ?? '') !== '') {
            $search = $options['search'];
            $operator = Pagination::searchOperator();

            $query->where(function ($builder) use ($search, $operator) {
                $builder
                    ->where('tracking_number', $operator, "%{$search}%")
                    ->orWhere('title', $operator, "%{$search}%")
                    ->orWhere('partner_institution', $operator, "%{$search}%");
            });
        }

        if (!empty($options['status'])) {
            $query->where('status', $options['status']);
        }

        $query->reorder(
            $options['sort'] ?? 'updated_at',
            $options['direction'] ?? 'desc'
        );
    }
}
