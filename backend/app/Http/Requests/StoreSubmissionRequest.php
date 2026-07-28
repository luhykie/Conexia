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
        $isDraft = $this->boolean('draft');

        $requiredText = $isDraft ? ['nullable', 'string', 'max:255'] : ['required', 'string', 'max:255'];
        $requiredEmail = $isDraft ? ['nullable', 'email', 'max:255'] : ['required', 'email', 'max:255'];
        $requiredDate = $isDraft ? ['nullable', 'date'] : ['required', 'date', 'after_or_equal:today'];

        return [
            'draft' => ['nullable', 'boolean'],
            'title' => $requiredText,
            'submission_type' => ['required', Rule::in(['new_partnership', 'renewal'])],
            'partner_classification' => ['required', Rule::in(['local', 'international'])],
            'contact_person' => $requiredText,
            'contact_position' => $requiredText,
            'contact_email' => $requiredEmail,
            'contact_number' => $isDraft ? ['nullable', 'string', 'max:50'] : ['required', 'string', 'max:50'],
            'partner_institution_name' => $isDraft ? ['nullable', 'string', 'max:255'] : ['required', 'string', 'max:255'],
            'agreement_type' => ['required', 'string', Rule::in([
                'Memorandum of Agreement (MOA)',
                'Memorandum of Understanding (MOU)',
                'Memorandum of Financial (MOF)',
            ])],
            'agreement_title' => $requiredText,
            'expected_duration' => $isDraft ? ['nullable', 'string', 'max:100'] : ['required', 'string', 'max:100'],
            'partner_contact_email' => $isDraft ? ['nullable', 'email', 'max:255'] : ['required', 'email', 'max:255'],
            'requested_completion_date' => $requiredDate,
            'urgency_level' => ['nullable', Rule::in(['normal', 'urgent', 'highly_urgent'])],
            'requested_by_name' => ['nullable', 'string', 'max:255'],
            'requested_by_date' => ['nullable', 'date'],
            'noted_by_name' => ['nullable', 'string', 'max:255'],
            'noted_by_date' => ['nullable', 'date'],
            'storage_path' => ['nullable', 'string', 'max:1000'],
            'file_name' => ['nullable', 'string', 'max:255'],
        ];
    }
}
