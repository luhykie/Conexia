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
                'logged',
                'review_form_generated',
                'under_review',
                'corrections_needed',
                'resubmitted',
                'approved',
                'notarization_form_generated',
                'pending_notarization',
                'notarized',
                'archived',
                'distributed',
            ])],
            'notes' => ['nullable', 'string', 'max:2000'],
            'metadata' => ['nullable', 'array'],
        ];
    }
}
