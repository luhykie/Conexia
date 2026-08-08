<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Profile;
use App\Models\RolePermission;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RoleSettingsController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Role permissions loaded successfully.',
            'data' => $this->matrix(),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'permissions' => ['required', 'array'],
        ]);

        $permissions = $validated['permissions'];
        $defaults = $this->defaults();

        if ($this->violatesProtectedBoundaries($permissions, $defaults)) {
            return response()->json([
                'success' => false,
                'message' => 'Protected role permissions cannot be changed.',
                'errors' => [
                    'permissions' => [
                        'Locked permissions are protected by system policy.',
                    ],
                ],
            ], 422);
        }

        DB::transaction(function () use ($request, $permissions, $defaults): void {
            foreach ($defaults as $role => $definition) {
                $requested = $permissions[$role] ?? [];
                $clean = [];

                foreach ($definition['permissions'] as $key => $defaultValue) {
                    $clean[$key] = in_array($key, $definition['locked'], true)
                        ? $defaultValue
                        : (bool) ($requested[$key] ?? $defaultValue);
                }

                RolePermission::query()->updateOrCreate(
                    ['role' => $role],
                    [
                        'permissions' => $clean,
                        'updated_by' => $request->attributes
                            ->get('authenticated_profile')?->id,
                    ]
                );
            }

            AuditLog::query()->create([
                'actor_id' => $request->attributes
                    ->get('authenticated_profile')?->id,
                'action' => 'super_admin.roles.updated',
                'metadata' => [
                    'roles' => array_keys($permissions),
                ],
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Role permissions saved successfully.',
            'data' => $this->matrix(),
        ]);
    }

    private function violatesProtectedBoundaries(
        array $permissions,
        array $defaults
    ): bool {
        foreach ($defaults as $role => $definition) {
            $requested = $permissions[$role] ?? [];

            foreach ($definition['locked'] as $lockedKey) {
                if (
                    array_key_exists($lockedKey, $requested)
                    && (bool) $requested[$lockedKey]
                        !== (bool) $definition['permissions'][$lockedKey]
                ) {
                    return true;
                }
            }
        }

        return false;
    }

    private function matrix(): array
    {
        $saved = RolePermission::query()
            ->get()
            ->keyBy('role');

        return collect($this->defaults())
            ->map(function (array $definition, string $role) use ($saved): array {
                $savedPermissions = $saved->get($role)?->permissions ?? [];
                $permissions = array_replace(
                    $definition['permissions'],
                    array_intersect_key(
                        $savedPermissions,
                        $definition['permissions']
                    )
                );

                foreach ($definition['locked'] as $lockedKey) {
                    $permissions[$lockedKey] =
                        $definition['permissions'][$lockedKey];
                }

                return [
                    'role' => $role,
                    'label' => $definition['label'],
                    'purpose' => $definition['purpose'],
                    'scope' => $definition['scope'],
                    'access_level' => $definition['access_level'],
                    'permissions' => $permissions,
                    'locked' => $definition['locked'],
                ];
            })
            ->values()
            ->all();
    }

    private function defaults(): array
    {
        return [
            Profile::ROLE_SUPER_ADMIN => [
                'label' => 'Super Admin',
                'purpose' => 'System governance',
                'scope' => 'No document workflow access',
                'access_level' => 'Protected',
                'locked' => [
                    'document_contents',
                    'files',
                    'workflow',
                    'assign_legal',
                ],
                'permissions' => [
                    'governance' => true,
                    'document_contents' => false,
                    'files' => false,
                    'workflow' => false,
                    'assign_legal' => false,
                    'user_management' => true,
                    'department_management' => true,
                    'audit_logs' => true,
                    'system_monitoring' => true,
                ],
            ],
            Profile::ROLE_IRO_ADMIN => [
                'label' => 'IRO Admin',
                'purpose' => 'Institutional Relations administration',
                'scope' => 'Document workflow management',
                'access_level' => 'Managed',
                'locked' => ['governance'],
                'permissions' => [
                    'governance' => false,
                    'document_contents' => true,
                    'files' => true,
                    'workflow' => true,
                    'assign_legal' => true,
                    'user_management' => true,
                    'department_management' => true,
                    'audit_logs' => false,
                    'system_monitoring' => false,
                ],
            ],
            Profile::ROLE_IRO_STAFF => [
                'label' => 'IRO Staff',
                'purpose' => 'Reminder support',
                'scope' => 'Reminder-level access only',
                'access_level' => 'Protected',
                'locked' => [
                    'governance',
                    'document_contents',
                    'files',
                    'workflow',
                    'assign_legal',
                    'user_management',
                    'department_management',
                    'audit_logs',
                    'system_monitoring',
                ],
                'permissions' => [
                    'governance' => false,
                    'document_contents' => false,
                    'files' => false,
                    'workflow' => false,
                    'assign_legal' => false,
                    'user_management' => false,
                    'department_management' => false,
                    'audit_logs' => false,
                    'system_monitoring' => false,
                ],
            ],
            Profile::ROLE_LEGAL_COUNSEL => [
                'label' => 'Legal Counsel',
                'purpose' => 'Legal review',
                'scope' => 'Assigned legal records only',
                'access_level' => 'Managed',
                'locked' => [
                    'governance',
                    'assign_legal',
                    'user_management',
                    'department_management',
                    'audit_logs',
                    'system_monitoring',
                ],
                'permissions' => [
                    'governance' => false,
                    'document_contents' => true,
                    'files' => true,
                    'workflow' => true,
                    'assign_legal' => false,
                    'user_management' => false,
                    'department_management' => false,
                    'audit_logs' => false,
                    'system_monitoring' => false,
                ],
            ],
            Profile::ROLE_DEPARTMENT_STAFF => [
                'label' => 'Department Staff',
                'purpose' => 'Department workspace',
                'scope' => 'Own department records only',
                'access_level' => 'Managed',
                'locked' => [
                    'governance',
                    'assign_legal',
                    'user_management',
                    'department_management',
                    'audit_logs',
                    'system_monitoring',
                ],
                'permissions' => [
                    'governance' => false,
                    'document_contents' => true,
                    'files' => true,
                    'workflow' => true,
                    'assign_legal' => false,
                    'user_management' => false,
                    'department_management' => false,
                    'audit_logs' => false,
                    'system_monitoring' => false,
                ],
            ],
        ];
    }
}
