<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\DepartmentResource;
use App\Models\AuditLog;
use App\Models\Department;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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
            'code'
        );
        $operator = Pagination::searchOperator();

        $query = Department::query()
            ->withCount('profiles')
            ->orderBy('code');

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
                'nullable',
                'email',
                'max:255',
            ],
            'office_assignment' => [
                'nullable',
                'string',
                'max:255',
            ],
        ]);

        $department = DB::transaction(function () use ($request, $validated) {
            $department = Department::query()->create([
                'code' => strtoupper(trim($validated['code'])),
                'name' => trim($validated['name']),
                'email' => $validated['email'] ?? null,
            ]);

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
}
