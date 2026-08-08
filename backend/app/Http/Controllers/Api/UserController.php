<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\AuditLog;
use App\Models\Profile;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    /**
     * Return users with optional search and filters.
     *
     * Examples:
     * GET /api/users
     * GET /api/users?search=admin
     * GET /api/users?role=department_staff
     * GET /api/users?department_id=uuid
     * GET /api/users?status=active
     */
    public function index(Request $request)
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],

            'role' => [
                'nullable',
                Rule::in([
                    Profile::ROLE_SUPER_ADMIN,
                    Profile::ROLE_IRO_ADMIN,
                    Profile::ROLE_IRO_STAFF,
                    Profile::ROLE_LEGAL_COUNSEL,
                    Profile::ROLE_DEPARTMENT_STAFF,
                ]),
            ],

            'department_id' => [
                'nullable',
                'uuid',
                'exists:departments,id',
            ],

            'status' => [
                'nullable',
                Rule::in(['active', 'inactive']),
            ],

            'per_page' => [
                'nullable',
                'integer',
                'min:1',
                'max:100',
            ],
            'page' => ['nullable', 'integer', 'min:1'],
            'sort' => [
                'nullable',
                Rule::in(['full_name', 'email', 'role']),
            ],
            'direction' => [
                'nullable',
                Rule::in(['asc', 'desc']),
            ],
        ]);

        $query = Profile::query()
            ->with('department');
        $operator = Pagination::searchOperator();

        if (!empty($validated['search'])) {
            $search = trim($validated['search']);

            $query->where(function ($builder) use ($search, $operator) {
                $builder
                    ->where('full_name', $operator, "%{$search}%")
                    ->orWhere('email', $operator, "%{$search}%");
            });
        }

        if (!empty($validated['role'])) {
            $query->where('role', $validated['role']);
        }

        if (!empty($validated['department_id'])) {
            $query->where(
                'department_id',
                $validated['department_id']
            );
        }

        if (!empty($validated['status'])) {
            $query->where(
                'is_active',
                $validated['status'] === 'active'
            );
        }

        $perPage = min(
            $validated['per_page'] ?? Pagination::DEFAULT_PER_PAGE,
            Pagination::MAX_PER_PAGE
        );
        $sort = $validated['sort'] ?? 'full_name';
        $direction = $validated['direction'] ?? 'asc';
        $page = $validated['page'] ?? 1;

        $users = $query
            ->orderBy($sort, $direction)
            ->paginate($perPage, ['*'], 'page', $page);

        return UserResource::collection(
            $users
        )->additional([
            'success' => true,
            'message' => 'Users loaded successfully.',
            'meta' => Pagination::meta($users),
        ]);
    }

    /**
     * Return one user.
     */
    public function show(Profile $profile): UserResource
    {
        $profile->load('department');

        return new UserResource($profile);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'full_name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'email',
                'max:255',
                Rule::unique('profiles', 'email'),
            ],
            'role' => [
                'required',
                Rule::in([
                    Profile::ROLE_SUPER_ADMIN,
                    Profile::ROLE_IRO_ADMIN,
                    Profile::ROLE_IRO_STAFF,
                    Profile::ROLE_LEGAL_COUNSEL,
                    Profile::ROLE_DEPARTMENT_STAFF,
                ]),
            ],
            'department_id' => [
                'nullable',
                'uuid',
                'exists:departments,id',
            ],
            'is_active' => ['required', 'boolean'],
        ]);

        if (
            $validated['role'] === Profile::ROLE_DEPARTMENT_STAFF
            && empty($validated['department_id'])
        ) {
            return response()->json([
                'success' => false,
                'message' => 'Department Staff must be assigned to a department.',
                'errors' => [
                    'department_id' => ['Department assignment is required.'],
                ],
            ], 422);
        }

        if ($validated['role'] !== Profile::ROLE_DEPARTMENT_STAFF) {
            $validated['department_id'] = null;
        }

        $supabaseUserId = $this->createSupabaseUser(
            strtolower(trim($validated['email'])),
            trim($validated['full_name'])
        );

        $profile = DB::transaction(function () use ($request, $validated, $supabaseUserId) {
            $profile = new Profile([
                'full_name' => trim($validated['full_name']),
                'email' => strtolower(trim($validated['email'])),
                'role' => $validated['role'],
                'department_id' => $validated['department_id'],
                'is_active' => $validated['is_active'],
            ]);

            $profile->id = $supabaseUserId;
            $profile->save();

            AuditLog::query()->create([
                'actor_id' => $request->attributes->get('authenticated_profile')?->id,
                'action' => 'super_admin.user.created',
                'metadata' => [
                    'profile_id' => $profile->id,
                    'email' => $profile->email,
                    'role' => $profile->role,
                ],
            ]);

            return $profile;
        });

        $profile->load('department');

        return response()->json([
            'success' => true,
            'message' => 'User created successfully.',
            'user' => new UserResource($profile),
        ], 201);
    }

    /**
     * Activate or deactivate a user.
     *
     * Body:
     * {
     *   "is_active": false
     * }
     */
    public function updateStatus(
        Request $request,
        Profile $profile
    ): JsonResponse {
        $validated = $request->validate([
            'is_active' => ['required', 'boolean'],
        ]);

        $profile->update([
            'is_active' => $validated['is_active'],
        ]);

        $profile->load('department');

        return response()->json([
            'ok' => true,
            'message' => $profile->is_active
                ? 'User account activated successfully.'
                : 'User account deactivated successfully.',
            'user' => new UserResource($profile),
        ]);
    }

    /**
     * Update a user's name, email, role or department.
     *
     * All fields are optional, but at least one must be sent.
     */
    public function updateAssignment(
        Request $request,
        Profile $profile
    ): JsonResponse {
        $validated = $request->validate([
            'full_name' => [
                'sometimes',
                'required',
                'string',
                'max:255',
            ],

            'email' => [
                'sometimes',
                'required',
                'email',
                'max:255',
                Rule::unique('profiles', 'email')
                    ->ignore($profile->id),
            ],

            'role' => [
                'sometimes',
                'required',
                Rule::in([
                    Profile::ROLE_SUPER_ADMIN,
                    Profile::ROLE_IRO_ADMIN,
                    Profile::ROLE_IRO_STAFF,
                    Profile::ROLE_LEGAL_COUNSEL,
                    Profile::ROLE_DEPARTMENT_STAFF,
                ]),
            ],

            'department_id' => [
                'sometimes',
                'nullable',
                'uuid',
                'exists:departments,id',
            ],
        ]);

        if (empty($validated)) {
            return response()->json([
                'ok' => false,
                'message' => 'No user changes were provided.',
            ], 422);
        }

        if (isset($validated['full_name'])) {
            $validated['full_name'] =
                trim($validated['full_name']);
        }

        if (isset($validated['email'])) {
            $validated['email'] =
                strtolower(trim($validated['email']));
        }

        /*
         * Only department staff should normally have a department.
         * Administrative roles will have department_id set to null.
         */
        $finalRole = $validated['role'] ?? $profile->role;

        if ($finalRole !== Profile::ROLE_DEPARTMENT_STAFF) {
            $validated['department_id'] = null;
        }

        if (
            $finalRole === Profile::ROLE_DEPARTMENT_STAFF
            && array_key_exists('department_id', $validated)
            && $validated['department_id'] === null
        ) {
            return response()->json([
                'ok' => false,
                'message' => 'Department Staff must be assigned to a department.',
            ], 422);
        }

        if (
            $finalRole === Profile::ROLE_DEPARTMENT_STAFF
            && !array_key_exists('department_id', $validated)
            && !$profile->department_id
        ) {
            return response()->json([
                'ok' => false,
                'message' => 'Department Staff must be assigned to a department.',
            ], 422);
        }

        $profile->update($validated);
        $profile->load('department');

        return response()->json([
            'ok' => true,
            'message' => 'User information updated successfully.',
            'user' => new UserResource($profile),
        ]);
    }

    private function createSupabaseUser(
        string $email,
        string $fullName
    ): string {
        $url = rtrim((string) config('supabase.url'), '/');
        $serviceRoleKey = config('supabase.service_role_key');

        if (!$url || !$serviceRoleKey) {
            abort(response()->json([
                'success' => false,
                'message' => 'Supabase Admin configuration is missing.',
                'errors' => [
                    'supabase' => ['Service role key is required on the backend.'],
                ],
            ], 422));
        }

        $response = Http::withToken($serviceRoleKey)
            ->withHeaders([
                'apikey' => $serviceRoleKey,
            ])
            ->post("{$url}/auth/v1/admin/users", [
                'email' => $email,
                'password' => Str::random(24).'aA1!',
                'email_confirm' => true,
                'user_metadata' => [
                    'full_name' => $fullName,
                ],
            ]);

        if ($response->status() === 422 || $response->status() === 409) {
            abort(response()->json([
                'success' => false,
                'message' => 'A Supabase Auth user with this email already exists.',
                'errors' => [
                    'email' => ['Email is already registered.'],
                ],
            ], 422));
        }

        if (!$response->successful()) {
            abort(response()->json([
                'success' => false,
                'message' => 'Unable to create the Supabase Auth user.',
            ], 502));
        }

        $id = $response->json('id');

        if (!$id) {
            abort(response()->json([
                'success' => false,
                'message' => 'Supabase Auth did not return a user ID.',
            ], 502));
        }

        return $id;
    }
}
