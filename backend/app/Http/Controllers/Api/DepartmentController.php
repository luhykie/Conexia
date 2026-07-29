<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\DepartmentResource;
use App\Models\Department;
use App\Support\Pagination;
use Illuminate\Http\Request;

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
}
