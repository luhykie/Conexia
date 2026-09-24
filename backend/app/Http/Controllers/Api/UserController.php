<?php
// [FEATURE: User Management] - manages user profiles, accounts, and directory access.

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
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Database\QueryException;
use Illuminate\Http\Exceptions\HttpResponseException;
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
            ->with('department')
            ->leftJoin('departments', 'departments.id', '=', 'profiles.department_id')
            ->select('profiles.*');
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
        $sort = $validated['sort'] ?? null;
        $direction = $validated['direction'] ?? 'asc';
        $page = $validated['page'] ?? 1;

        // Default directory order follows the RBAC hierarchy, then department/name alphabetically.
        if ($sort === null) {
            $users = $query
                ->orderByRaw("
                    CASE profiles.role
                        WHEN ? THEN 1
                        WHEN ? THEN 2
                        WHEN ? THEN 3
                        WHEN ? THEN 4
                        ELSE 5
                    END
                ", [
                    Profile::ROLE_SUPER_ADMIN,
                    Profile::ROLE_IRO_ADMIN,
                    Profile::ROLE_LEGAL_COUNSEL,
                    Profile::ROLE_DEPARTMENT_STAFF,
                ])
                ->orderByRaw('LOWER(COALESCE(departments.name, \'\')) ASC')
                ->orderByRaw('LOWER(profiles.full_name) ASC')
                ->paginate($perPage, ['profiles.*'], 'page', $page);
        } else {
            $users = $query
                ->orderBy("profiles.{$sort}", $direction)
                ->paginate($perPage, ['profiles.*'], 'page', $page);
        }

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

    // Creates a managed user while enforcing protected role boundaries.
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

        $email = strtolower(trim($validated['email']));

        // Check the local profile first so duplicate emails receive a deliberate conflict response.
        if (Profile::query()->where('email', $email)->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'A user with this email already exists.',
                'errors' => ['email' => ['Email is already registered.']],
            ], 409);
        }

        $supabaseUserId = null;

        try {
            $supabaseUserId = $this->createSupabaseUser(
                $email,
                trim($validated['full_name'])
            );
            Log::info('Supabase Auth user ID returned before profile transaction.', [
                'email' => $email,
                'supabase_user_id' => $supabaseUserId,
            ]);

            $profile = DB::transaction(function () use ($request, $validated, $email, $supabaseUserId) {
                $profile = new Profile([
                    'full_name' => trim($validated['full_name']),
                    'email' => $email,
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

        } catch (HttpResponseException $exception) {
            // Keep deliberate Auth/API validation messages while never exposing unexpected exceptions.
            throw $exception;
        } catch (QueryException $exception) {
            $this->removeOrphanedSupabaseUser($supabaseUserId);

            $constraint = strtolower((string) ($exception->errorInfo[2] ?? ''));

            if (
                $exception->getCode() === '23505'
                && str_contains($constraint, 'email')
            ) {
                Log::notice('Duplicate user creation prevented.', [
                    'email' => $email,
                    'constraint' => $constraint,
                ]);

                return response()->json([
                    'success' => false,
                    'message' => 'A user with this email already exists.',
                    'errors' => ['email' => ['Email is already registered.']],
                ], 409);
            }

            Log::error('Unexpected database error while creating user.', [
                'email' => $email,
                'exception' => $exception,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Unable to create user. Please try again or contact support.',
            ], 500);
        } catch (\Throwable $exception) {
            $this->removeOrphanedSupabaseUser($supabaseUserId);
            Log::error('Unexpected error while creating user.', [
                'email' => $email,
                'exception' => $exception,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Unable to create user. Please try again or contact support.',
            ], 500);
        }

        try {
            // The transaction has committed before this response work begins. Previously,
            // a later response error fell into the creation catch and deleted the already-
            // committed Auth user; keeping this phase separate prevents that orphaning bug.
            $profile->load('department');
            $user = (new UserResource($profile))->resolve($request);

            return response()->json([
                'success' => true,
                'message' => 'User created successfully.',
                'user' => $user,
            ], 201);
        } catch (\Throwable $exception) {
            Log::error('User was created but its response could not be built.', [
                'email' => $email,
                'profile_id' => $profile->id,
                'exception' => $exception,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'User was created, but the response could not be prepared. Please refresh the user directory.',
            ], 500);
        }
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

    // Permanently deletes both the local profile and its Supabase Auth account.
    // Referenced document/workflow records remain protected, while audit history keeps a null actor.
    public function destroy(
        Request $request,
        Profile $profile
    ): JsonResponse {
        if ($profile->role === Profile::ROLE_SUPER_ADMIN
            && Profile::query()
                ->where('role', Profile::ROLE_SUPER_ADMIN)
                ->count() <= 1
        ) {
            return response()->json([
                'success' => false,
                'message' => 'The last Super Admin account cannot be deleted.',
            ], 422);
        }

        $hasReferences = $profile->submittedDocuments()->exists()
            || $profile->assignedDocuments()->exists()
            || $profile->notifications()->exists()
            || $profile->documentMessages()->exists()
            || $profile->documentFiles()->exists()
            || DB::table('document_review_items')
                ->where('author_id', $profile->id)
                ->exists()
            || DB::table('document_discussion_messages')
                ->where('author_id', $profile->id)
                ->exists()
            || DB::table('document_department_reviews')
                ->where('approved_by', $profile->id)
                ->exists();

        if ($hasReferences) {
            return response()->json([
                'success' => false,
                'message' => 'This user cannot be deleted because records still reference the account.',
            ], 409);
        }

        $profileAttributes = $profile->getAttributes();
        $profileDeleted = false;
        try {
            // Delete the local profile first inside a transaction so audit references are cleared atomically.
            DB::transaction(function () use ($profile): void {
                AuditLog::query()
                    ->where('actor_id', $profile->id)
                    ->update(['actor_id' => null]);

                $profile->delete();
            });
            $profileDeleted = true;

            // Delete the matching Supabase Auth account so the email can be registered again.
            $this->deleteSupabaseUser($profile->id);
        } catch (\Throwable $exception) {
            if ($profileDeleted) {
                // Restore the profile if Auth deletion fails, avoiding a silent half-deleted account.
                try {
                    DB::transaction(function () use ($profileAttributes): void {
                        Profile::query()->create($profileAttributes);
                    });
                } catch (\Throwable $restoreException) {
                    Log::critical('User deletion failed and profile restoration also failed.', [
                        'profile_id' => $profile->id,
                        'exception' => $exception,
                        'restore_exception' => $restoreException,
                    ]);
                }
            }

            Log::error('User deletion failed.', [
                'profile_id' => $profile->id,
                'exception' => $exception,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'User deletion was incomplete. Please try again or contact support.',
            ], 502);
        }

        try {
            AuditLog::query()->create([
                'actor_id' => $request->attributes->get('authenticated_profile')?->id,
                'action' => 'super_admin.user.deleted',
                'metadata' => ['profile_id' => $profile->id],
            ]);
        } catch (\Throwable $exception) {
            // Deletion succeeded even if its optional audit entry cannot be written; log without exposing internals.
            Log::error('User deletion audit entry could not be written.', [
                'profile_id' => $profile->id,
                'exception' => $exception,
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'User account and login access were permanently deleted.',
        ]);
    }

    // Creates the authentication account backing a new local user profile.
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

        Log::info('Supabase create-user raw response', ['body' => $response->json()]);

        $responseBody = $response->json();
        $responseMessage = strtolower((string) (
            $responseBody['msg']
            ?? $responseBody['message']
            ?? $responseBody['error_description']
            ?? ''
        ));
        $responseCode = strtolower((string) (
            $responseBody['code']
            ?? $responseBody['error_code']
            ?? ''
        ));
        $isDuplicateEmail = in_array($responseCode, [
            'email_exists',
            'user_already_exists',
        ], true) || str_contains($responseMessage, 'already registered')
            || str_contains($responseMessage, 'already exists')
            || str_contains($responseMessage, 'email exists');

        if (($response->status() === 409 || $response->status() === 422)
            && $isDuplicateEmail
        ) {
            abort(response()->json([
                'success' => false,
                'message' => 'A Supabase Auth user with this email already exists.',
                'errors' => [
                    'email' => ['Email is already registered.'],
                ],
            ], 422));
        }

        if (!$response->successful()) {
            Log::error('Supabase Auth user creation failed.', [
                'status' => $response->status(),
                'code' => $responseCode ?: null,
                'message' => $responseMessage ?: null,
            ]);

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

    // Removes only the Auth account created by this request when profile creation fails.
    private function removeOrphanedSupabaseUser(?string $userId): void
    {
        if (!$userId) {
            return;
        }

        $url = rtrim((string) config('supabase.url'), '/');
        $serviceRoleKey = config('supabase.service_role_key');

        if (!$url || !$serviceRoleKey) {
            return;
        }

        $response = Http::withToken($serviceRoleKey)
            ->withHeaders(['apikey' => $serviceRoleKey])
            ->delete("{$url}/auth/v1/admin/users/{$userId}");

        if (!$response->successful()) {
            Log::warning('Unable to remove orphaned Supabase Auth user.', [
                'user_id' => $userId,
                'status' => $response->status(),
            ]);
        }
    }

    // Deletes the Auth identity using the same server-only Supabase REST pattern as account creation.
    private function deleteSupabaseUser(string $userId): void
    {
        $url = rtrim((string) config('supabase.url'), '/');
        $serviceRoleKey = config('supabase.service_role_key');

        if (!$url || !$serviceRoleKey) {
            throw new \RuntimeException('Supabase Admin configuration is missing.');
        }

        $response = Http::withToken($serviceRoleKey)
            ->withHeaders(['apikey' => $serviceRoleKey])
            ->delete("{$url}/auth/v1/admin/users/{$userId}");

        if (!$response->successful() && $response->status() !== 404) {
            throw new \RuntimeException('Supabase Auth user deletion failed.');
        }

        // The admin DELETE is synchronous for the request, but confirmation prevents
        // returning success while Auth still exposes the identity to a new create call.
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $check = Http::withToken($serviceRoleKey)
                ->withHeaders(['apikey' => $serviceRoleKey])
                ->get("{$url}/auth/v1/admin/users/{$userId}");

            if ($check->status() === 404) {
                return;
            }

            if (!$check->successful()) {
                throw new \RuntimeException('Supabase Auth user deletion could not be confirmed.');
            }

            usleep(100000);
        }

        throw new \RuntimeException('Supabase Auth user deletion could not be confirmed.');
    }
}
