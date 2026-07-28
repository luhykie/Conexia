<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateSubmissionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['nullable', 'string', 'max:255'],
            'submission_type' => ['nullable', Rule::in(['new_partnership', 'renewal'])],
            'partner_classification' => ['nullable', Rule::in(['local', 'international'])],
            'contact_person' => ['nullable', 'string', 'max:255'],
            'contact_position' => ['nullable', 'string', 'max:255'],
            'contact_email' => ['nullable', 'email', 'max:255'],
            'contact_number' => ['nullable', 'string', 'max:50'],
            'partner_institution_name' => ['nullable', 'string', 'max:255'],
            'agreement_type' => ['nullable', 'string', Rule::in([
                'Memorandum of Agreement (MOA)',
                'Memorandum of Understanding (MOU)',
                'Memorandum of Financial (MOF)',
            ])],
            'agreement_title' => ['nullable', 'string', 'max:500'],
            'expected_duration' => ['nullable', 'string', 'max:100'],
            'partner_contact_email' => ['nullable', 'email', 'max:255'],
            'requested_completion_date' => ['nullable', 'date'],
            'urgency_level' => ['nullable', Rule::in(['normal', 'urgent', 'highly_urgent'])],
            'requested_by_name' => ['nullable', 'string', 'max:255'],
            'requested_by_date' => ['nullable', 'date'],
            'noted_by_name' => ['nullable', 'string', 'max:255'],
            'noted_by_date' => ['nullable', 'date'],
            'storage_path' => ['nullable', 'string', 'max:1000'],
            'file_name' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'string'],
            'current_stage' => ['nullable', 'string'],
        ];
    }
}
