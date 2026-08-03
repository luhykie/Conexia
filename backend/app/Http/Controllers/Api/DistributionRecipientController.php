<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DistributionRecipient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DistributionRecipientController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'document_type' => ['nullable', Rule::in(['MOA', 'MOU', 'MOF'])],
        ]);

        $recipients = DistributionRecipient::query()
            ->when(
                $validated['document_type'] ?? null,
                fn ($query, string $type) => $query->where('document_type', $type)
            )
            ->orderBy('document_type')
            ->orderBy('recipient_name')
            ->get();

        return response()->json(['data' => $recipients]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validateRecipient($request);
        $profileId = $request->attributes->get('auth_profile')->id;

        $recipient = DistributionRecipient::create([
            ...$validated,
            'recipient_email' => strtolower($validated['recipient_email']),
            'is_required' => $validated['is_required'] ?? true,
            'is_active' => $validated['is_active'] ?? true,
            'created_by' => $profileId,
            'updated_by' => $profileId,
        ]);

        return response()->json([
            'message' => 'Distribution recipient added.',
            'data' => $recipient,
        ], 201);
    }

    public function update(
        Request $request,
        DistributionRecipient $distributionRecipient
    ): JsonResponse {
        $validated = $this->validateRecipient($request, $distributionRecipient);

        $distributionRecipient->update([
            ...$validated,
            'recipient_email' => strtolower($validated['recipient_email']),
            'updated_by' => $request->attributes->get('auth_profile')->id,
        ]);

        return response()->json([
            'message' => 'Distribution recipient updated.',
            'data' => $distributionRecipient->fresh(),
        ]);
    }

    private function validateRecipient(
        Request $request,
        ?DistributionRecipient $recipient = null
    ): array {
        return $request->validate([
            'document_type' => ['required', Rule::in(['MOA', 'MOU', 'MOF'])],
            'recipient_name' => ['required', 'string', 'max:255'],
            'recipient_email' => [
                'required',
                'email',
                'max:255',
                Rule::unique('distribution_recipients', 'recipient_email')
                    ->where(fn ($query) => $query->where(
                        'document_type',
                        $request->input('document_type')
                    ))
                    ->ignore($recipient?->id),
            ],
            'organization' => ['nullable', 'string', 'max:255'],
            'role_scope' => [
                'required',
                Rule::in(['Signatory', 'Reviewer', 'CC']),
            ],
            'access_level' => [
                'required',
                Rule::in(['Full Access', 'View Only']),
            ],
            'is_required' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }
}
