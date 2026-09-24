<?php
// [FEATURE: Department Management] - manages departments and department-scoped workflow data.

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\DepartmentResource;
use App\Models\AuditLog;
use App\Models\Department;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class DepartmentController extends Controller
{
    /**
     * Return departments for tables and dropdowns.
     */
    public function index(Request $request)
    {
        $options = Pagination::options(
            $request,
            ['code', 'name'],
            'name'
        );
        $operator = Pagination::searchOperator();

        $query = Department::query()
            ->withCount('profiles')
            // Department Management defaults to alphabetical department-name order.
            ->orderBy('name');

        if ($options['search'] !== '') {
            $search = $options['search'];

            $query->where(function ($builder) use ($search, $operator) {
                $builder
                    ->where('code', $operator, "%{$search}%")
                    ->orWhere('name', $operator, "%{$search}%");
            });
        }

        $departments = $query
            ->reorder($options['sort'], $options['direction'])
            ->paginate(
                $options['per_page'],
                ['*'],
                'page',
                $options['page']
            );

        return DepartmentResource::collection(
            $departments
        )->additional([
            'success' => true,
            'message' => 'Departments loaded successfully.',
            'meta' => Pagination::meta($departments),
        ]);
    }

    /**
     * Return one department.
     */
    public function show(
        Department $department
    ): DepartmentResource {
        $department->loadCount('profiles');

        return new DepartmentResource($department);
    }

    /**
     * Create a department directory entry.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => [
                'required',
                'string',
                'max:30',
                Rule::unique('departments', 'code'),
            ],
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('departments', 'name'),
            ],
            'email' => [
                'required',
                'email',
                'max:255',
                Rule::unique('departments', 'email'),
            ],
            'office_assignment' => [
                'nullable',
                'string',
                'max:255',
            ],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $department = DB::transaction(function () use ($request, $validated) {
            $attributes = [
                'code' => strtoupper(trim($validated['code'])),
                'name' => trim($validated['name']),
                'email' => $validated['email'] ?? null,
            ];

            // Write newer directory fields only when the deployed database has those columns.
            if (Schema::hasColumn('departments', 'office_assignment')) {
                $attributes['office_assignment'] =
                    $validated['office_assignment'] ?? null;
            }

            if (Schema::hasColumn('departments', 'is_active')) {
                $attributes['is_active'] = $validated['is_active'] ?? true;
            }

            $department = Department::query()->create($attributes);

            AuditLog::query()->create([
                'actor_id' => $request->attributes->get('authenticated_profile')?->id,
                'action' => 'super_admin.department.created',
                'metadata' => [
                    'department_id' => $department->id,
                    'code' => $department->code,
                    'name' => $department->name,
                ],
            ]);

            return $department;
        });

        $department->loadCount('profiles');

        return response()->json([
            'success' => true,
            'message' => 'Department created successfully.',
            'data' => new DepartmentResource($department),
        ], 201);
    }

    // Updates all editable department directory fields and enforces unique code/email values.
    public function update(Request $request, Department $department): JsonResponse
    {
        $validated = $request->validate([
            'code' => [
                'required',
                'string',
                'max:30',
                Rule::unique('departments', 'code')->ignore($department->id),
            ],
            'name' => ['required', 'string', 'max:255'],
            'office_assignment' => ['sometimes', 'nullable', 'string', 'max:255'],
            'email' => [
                'required',
                'email',
                'max:255',
                Rule::unique('departments', 'email')->ignore($department->id),
            ],
            'is_active' => ['required', 'boolean'],
        ]);

        $changes = [
            'code' => strtoupper(trim($validated['code'])),
            'name' => trim($validated['name']),
            'email' => strtolower(trim($validated['email'])),
        ];

        // Keep Save Changes compatible with databases that have not run the department-fields migration yet.
        if (Schema::hasColumn('departments', 'is_active')) {
            $changes['is_active'] = $validated['is_active'];
        }

        if (array_key_exists('office_assignment', $validated)) {
            $changes['office_assignment'] = $validated['office_assignment'];
        }

        $department->update($changes);

        $department->loadCount('profiles');

        return response()->json([
            'success' => true,
            'message' => 'Department updated successfully.',
            'data' => new DepartmentResource($department),
        ]);
    }

    // Permanently deletes only unused departments so profiles and documents are not orphaned.
    public function destroy(Department $department): JsonResponse
    {
        $hasDocuments = $department->documents()->exists()
            || DB::table('documents')
                ->where('partner_department_id', $department->id)
                ->exists();

        if ($department->profiles()->exists() || $hasDocuments) {
            return response()->json([
                'success' => false,
                'message' => 'This department cannot be deleted because users or documents still reference it.',
            ], 409);
        }

        $departmentId = $department->id;
        $department->delete();

        AuditLog::query()->create([
            'actor_id' => request()->attributes->get('authenticated_profile')?->id,
            'action' => 'super_admin.department.deleted',
            'metadata' => ['department_id' => $departmentId],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Department deleted permanently.',
        ]);
    }
}
