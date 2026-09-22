<?php
// [FEATURE: User Management] - manages user profiles, accounts, and directory access.

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    // Converts a user profile into its public API representation.
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,

            // Database-style values
            'full_name' => $this->full_name,
            'email' => strtolower($this->email),
            'role' => $this->role,
            'department_id' => $this->department_id,
            'is_active' => (bool) $this->is_active,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,

            // Related department
            'department' => $this->whenLoaded('department', function () {
                if (!$this->department) {
                    return null;
                }

                return [
                    'id' => $this->department->id,
                    'code' => $this->department->code,
                    'name' => $this->department->name,
                    'email' => $this->department->email,
                ];
            }),

            // Frontend-friendly values
            'fullName' => $this->full_name,
            'roleLabel' => $this->roleLabel(),
            'departmentCode' => $this->department?->code,
            'departmentName' => $this->department?->name,
            'status' => $this->is_active ? 'Active' : 'Inactive',

            // Temporary until login tracking is added
            'lastLogin' => 'Never',
        ];
    }

    // Converts the stored role into a readable user-directory label.
    private function roleLabel(): string
    {
        return match ($this->role) {
            'super_admin' => 'Super Admin',
            'iro_admin' => 'IRO Admin',
            'legal_counsel' => 'Legal Counsel',
            'department_staff' => 'Department Staff',
            default => ucwords(str_replace('_', ' ', $this->role)),
        };
    }
}
