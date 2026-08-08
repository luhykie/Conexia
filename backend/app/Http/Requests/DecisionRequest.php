<?php

namespace App\Http\Requests;

use App\Models\Document;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Validation\Rule;

class DecisionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => [
                'required',
                Rule::in([
                    Document::STATUS_APPROVED,
                    Document::STATUS_CORRECTIONS_NEEDED,
                ]),
            ],
            'legal_notes' => [
                'nullable',
                'required_if:status,'.Document::STATUS_CORRECTIONS_NEEDED,
                'string',
                'max:5000',
            ],
        ];
    }

    protected function failedValidation(
        Validator $validator
    ): void {
        throw new HttpResponseException(
            response()->json([
                'success' => false,
                'message' => 'The legal decision data is invalid.',
                'errors' => $validator->errors(),
            ], 422)
        );
    }
}
