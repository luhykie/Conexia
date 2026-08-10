<?php

namespace App\Support;

use App\Models\Document;

class DocumentPayload
{
    public static function make(Document $document): array
    {
        $document->loadMissing('department');

        return [
            'id' => $document->id,
            'tracking_number' => $document->tracking_number,
            'title' => $document->title,
            'document_type' => $document->document_type,
            'partner_institution' => $document->partner_institution,
            'partner_email' => $document->partner_email,
            'description' => $document->description,
            'department_id' => $document->department_id,
            'partnership_type' => $document->partnership_type,
            'partnership_scope' => $document->partnership_scope,
            'contact_person' => $document->contact_person,
            'contact_position' => $document->contact_position,
            'contact_email' => $document->contact_email,
            'contact_number' => $document->contact_number,
            'urgency' => $document->urgency,
            'requested_completion_date' =>
                $document->requested_completion_date?->toDateString(),
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
            'archived_at' =>
                $document->archived_at?->toISOString(),
            'archived_by' => $document->archived_by,
            'effective_date' =>
                $document->effective_date?->toDateString(),
            'expiry_date' =>
                $document->expiry_date?->toDateString(),
            'renewal_notice_days' =>
                $document->renewal_notice_days,
            'renewal_status' =>
                $document->renewal_status,
            'submitted_at' =>
                $document->submitted_at?->toISOString(),
            'updated_at' =>
                $document->updated_at?->toISOString(),
            'department' => $document->department
                ? [
                    'id' => $document->department->id,
                    'code' => $document->department->code,
                    'name' => $document->department->name,
                ]
                : null,
        ];
    }
}
