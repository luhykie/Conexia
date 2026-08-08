<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class NotarizationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'notarial_reference_number' => [
                'required',
                'string',
                'max:255',
            ],
            'notarization_date' => [
                'required',
                'date',
            ],
            'notary_signature_code' => [
                'required',
                'string',
                'max:255',
            ],
        ];
    }

    protected function failedValidation(
        Validator $validator
    ): void {
        throw new HttpResponseException(
            response()->json([
                'success' => false,
                'message' => 'The notarization data is invalid.',
                'errors' => $validator->errors(),
            ], 422)
        );
    }
}
