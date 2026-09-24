<?php
// [FEATURE: Department Management] - manages departments and department-scoped workflow data.

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DepartmentResource extends JsonResource
{
    // Coordinates array within the department management and department-scoped workflow.
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'email' => $this->email,
            'office_assignment' => $this->office_assignment,
            'office' => $this->office_assignment,
            // Legacy deployments without is_active remain visible as Active until migrations run.
            'is_active' => $this->is_active === null ? true : (bool) $this->is_active,
            'status' => $this->is_active === false ? 'Inactive' : 'Active',
            'staff_count' => $this->whenCounted('profiles'),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}