<?php
// [FEATURE: IRO Admin Workflow] - supports document intake, file handling, and administrative workflow processing.

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

class DocumentFileUploadRequest extends FormRequest
{
    // Authorizes the operation within the document intake, file handling, and administrative workflow.
    public function authorize(): bool
    {
        return true;
    }

    // Renders the page for the document intake, file handling, and administrative workflow.
    public function rules(): array
    {
        return [
            'file' => [
                'required',
                'file',
                'min:1',
                'max:25600',
                'mimetypes:application/pdf,application/x-pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text,application/zip,application/x-zip-compressed',
            ],
        ];
    }

    // Coordinates validation within the document intake, file handling, and administrative workflow.
    protected function failedValidation(
        Validator $validator
    ): void {
        throw new HttpResponseException(
            response()->json([
                'success' => false,
                'message' => 'The uploaded file is invalid.',
                'errors' => $validator->errors(),
            ], 422)
        );
    }
}
