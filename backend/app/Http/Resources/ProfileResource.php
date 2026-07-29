<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProfileResource extends JsonResource
{
    /**
     * Transform the profile into the account format expected by React.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->full_name,
            'fullName' => $this->full_name,
            'email' => $this->email,

            'databaseRole' => $this->role,
            'roleKey' => $this->roleKey($this->role),

            'departmentId' => $this->department_id,

            'department' => $this->whenLoaded(
                'department',
                fn (): ?array => $this->department
                    ? [
                        'id' => $this->department->id,
                        'name' => $this->department->name,
                        'code' => $this->department->code,
                    ]
                    : null
            ),

            'isActive' => (bool) $this->is_active,
        ];
    }

    private function roleKey(string $databaseRole): ?string
    {
        return match ($databaseRole) {
            'super_admin' => 'super',
            'iro_admin' => 'admin',
            'iro_staff' => 'staff',
            'legal_counsel' => 'legal',
            'department_staff' => 'department',
            default => null,
        };
    }
}