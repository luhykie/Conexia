<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateSubmissionStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in([
                'pending_iro_staff_review',
                'under_iro_staff_review',
                'approved_by_iro_staff',
                'pending_iro_admin_review',
                'under_iro_admin_review',
                'revision_required',
                'pending_legal_review',
                'legal_review',
                'legal_revision_required',
                'revised_by_department',
                'completed',
                'legally_approved',
                'rejected',
            ])],
            'notes' => ['nullable', 'string', 'max:2000'],
            'metadata' => ['nullable', 'array'],
        ];
    }
}
