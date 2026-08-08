<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\DistributionRecipient;
use App\Models\Document;
use App\Models\DocumentFile;
use App\Models\Engagement;
use App\Models\WorkflowEvent;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class EngagementController extends Controller
{
    public function __construct(private readonly NotificationService $notifications)
    {
    }

    public function index(): JsonResponse
    {
        $engagements = Engagement::query()
            ->with([
                'departments:id,name',
                'distributionRecipients:id,recipient_name,recipient_email,organization,role_scope',
                'document:id,tracking_number,document_type,status,submitted_at,updated_at,effective_date,expiry_date',
                'document.files:id,document_id,file_category,original_filename,mime_type,size,created_at',
                'document.workflowEvents:id,document_id,actor_role,event_type,from_status,to_status,notes,created_at',
            ])
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['data' => $engagements]);
    }

    public function options(): JsonResponse
    {
        return response()->json(['data' => [
            'departments' => Department::query()->orderBy('name')->get(['id', 'name']),
            'distributionRecipients' => DistributionRecipient::query()
                ->where('is_active', true)
                ->orderBy('document_type')
                ->orderBy('recipient_name')
                ->get(['id', 'document_type', 'recipient_name', 'recipient_email', 'organization', 'role_scope']),
        ]]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'client_submission_id' => ['required', 'uuid'],
            'agreement_type' => ['required', Rule::in(['MOA', 'MOU', 'MOF'])],
            'engagement_type' => ['required', Rule::in(['New Partnership', 'Renewal of Existing Partnership'])],
            'partner_classification' => ['required', Rule::in(['Local', 'International'])],
            'partner_name' => ['required', 'string', 'max:255'],
            'partner_email' => ['nullable', 'email', 'max:255'],
            'partner_contact' => ['nullable', 'string', 'max:255'],
            'partner_address' => ['nullable', 'string', 'max:2000'],
            'agreement_title' => ['required', 'string', 'max:255'],
            'agreement_summary' => ['nullable', 'string', 'max:5000'],
            'effective_date' => ['nullable', 'date'],
            'expiry_date' => ['nullable', 'date', 'after_or_equal:effective_date'],
            'department_ids' => ['required', 'array', 'min:1'],
            'department_ids.*' => ['uuid', Rule::exists('departments', 'id')],
            'distribution_recipient_ids' => ['sometimes', 'array'],
            'distribution_recipient_ids.*' => ['uuid', Rule::exists('distribution_recipients', 'id')->where('is_active', true)],
            'draft' => ['required', 'file', 'max:25600', 'mimes:pdf,doc,docx,odt'],
            'attachments' => ['sometimes', 'array', 'max:10'],
            'attachments.*' => ['file', 'max:25600', 'mimes:pdf,doc,docx,odt,xls,xlsx'],
        ]);

        $profile = $request->attributes->get('auth_profile');
        $existing = Engagement::query()
            ->where('client_submission_id', $validated['client_submission_id'])
            ->where('created_by', $profile->id)
            ->first();

        if ($existing) {
            return response()->json([
                'message' => 'This engagement was already submitted.',
                'data' => $existing->load([
                    'departments',
                    'distributionRecipients',
                    'document.files',
                    'document.workflowEvents',
                ]),
            ]);
        }

        $storedPaths = [];

        try {
            $engagement = DB::transaction(function () use ($validated, $profile, &$storedPaths): Engagement {
                $document = Document::create([
                    'tracking_number' => $this->nextTrackingNumber(),
                    'title' => $validated['agreement_title'],
                    'document_type' => $validated['agreement_type'],
                    'partner_institution' => $validated['partner_name'],
                    'partner_email' => $validated['partner_email'] ?? null,
                    'description' => $validated['agreement_summary'] ?? null,
                    'department_id' => $validated['department_ids'][0],
                    'submitted_by' => $profile->id,
                    // IRO Admin is authorized to perform the logging step, so
                    // Admin-created engagements bypass the Staff incoming queue.
                    'status' => 'Logged',
                    'submitted_at' => now(),
                    'updated_at' => now(),
                    'effective_date' => $validated['effective_date'] ?? null,
                    'expiry_date' => $validated['expiry_date'] ?? null,
                ]);

                $engagement = Engagement::create([
                    'client_submission_id' => $validated['client_submission_id'],
                    'document_id' => $document->id,
                    'engagement_type' => $validated['engagement_type'],
                    'partner_classification' => $validated['partner_classification'],
                    'partner_name' => $validated['partner_name'],
                    'partner_email' => $validated['partner_email'] ?? null,
                    'partner_contact' => $validated['partner_contact'] ?? null,
                    'partner_address' => $validated['partner_address'] ?? null,
                    'agreement_title' => $validated['agreement_title'],
                    'agreement_summary' => $validated['agreement_summary'] ?? null,
                    'effective_date' => $validated['effective_date'] ?? null,
                    'expiry_date' => $validated['expiry_date'] ?? null,
                    'lifecycle_status' => $validated['engagement_type'] === 'Renewal of Existing Partnership' ? 'Renewed' : 'Active',
                    'created_by' => $profile->id,
                ]);
                $engagement->departments()->sync($validated['department_ids']);
                $engagement->distributionRecipients()->sync($validated['distribution_recipient_ids'] ?? []);

                $files = [['file' => $validated['draft'], 'category' => 'original_draft']];
                foreach ($validated['attachments'] ?? [] as $attachment) {
                    $files[] = ['file' => $attachment, 'category' => 'supporting_attachment'];
                }
                foreach ($files as $index => $item) {
                    $path = $item['file']->store("documents/{$document->id}", 'local');
                    $storedPaths[] = $path;
                    DocumentFile::create([
                        'document_id' => $document->id,
                        'uploaded_by' => $profile->id,
                        'file_category' => $item['category'],
                        'original_filename' => $item['file']->getClientOriginalName(),
                        'stored_filename' => basename($path),
                        'storage_disk' => 'local',
                        'storage_path' => $path,
                        'mime_type' => $item['file']->getMimeType(),
                        'size' => $item['file']->getSize(),
                        'version' => $index + 1,
                    ]);
                }

                WorkflowEvent::create([
                    'document_id' => $document->id,
                    'actor_id' => $profile->id,
                    'actor_role' => $profile->role,
                    'event_type' => 'engagement_created_by_iro_admin',
                    'from_status' => null,
                    'to_status' => 'Logged',
                    'notes' => "{$validated['engagement_type']} created and logged by IRO Admin for {$validated['partner_name']}.",
                    'created_at' => now(),
                ]);
                $this->notifications->documentLogged($document, $profile);

                return $engagement;
            });
        } catch (\Throwable $error) {
            foreach ($storedPaths as $path) {
                Storage::disk('local')->delete($path);
            }
            throw $error;
        }

        return response()->json([
            'message' => 'Engagement submitted to the CONEXIA review workflow.',
            'data' => $engagement->load(['departments', 'distributionRecipients', 'document.files', 'document.workflowEvents']),
        ], 201);
    }

    private function nextTrackingNumber(): string
    {
        do {
            $number = 'IRO-'.now()->format('Ymd').'-'.strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
        } while (Document::query()->where('tracking_number', $number)->exists());

        return $number;
    }
}
