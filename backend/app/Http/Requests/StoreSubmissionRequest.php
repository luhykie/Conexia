<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSubmissionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'contact_person' => ['required', 'string', 'max:255'],
            'contact_position' => ['required', 'string', 'max:255'],
            'contact_email' => ['required', 'email', 'max:255'],
            'contact_number' => ['required', 'string', 'max:50'],
            'partner_institution_name' => ['required', 'string', 'max:255'],
            'agreement_type' => ['required', 'string', Rule::in([
                'Memorandum of Agreement (MOA)',
                'Memorandum of Understanding (MOU)',
                'Memorandum of Financial (MOF)',
            ])],
            'agreement_title' => ['required', 'string', 'max:500'],
            'expected_duration' => ['required', 'string', 'max:100'],
            'partner_contact_email' => ['required', 'email', 'max:255'],
            'requested_completion_date' => ['required', 'date', 'after_or_equal:today'],
            'urgency_level' => ['required', Rule::in(['normal', 'urgent', 'highly_urgent'])],
            'requested_by_name' => ['required', 'string', 'max:255'],
            'requested_by_date' => ['nullable', 'date'],
            'noted_by_name' => ['nullable', 'string', 'max:255'],
            'noted_by_date' => ['nullable', 'date'],
            'storage_path' => ['nullable', 'string', 'max:1000'],
            'file_name' => ['nullable', 'string', 'max:255'],
        ];
    }
}
