<?php

namespace App\Repositories;

use App\Models\Department;
use App\Models\Document;
use App\Models\Profile;
use Illuminate\Database\Eloquent\Collection;

class DashboardRepository
{
    public function departmentDocuments(Profile $profile): Collection
    {
        return Document::query()
            ->select($this->dashboardColumns())
            ->with('department')
            ->where('department_id', $profile->department_id)
            ->orderByDesc('updated_at')
            ->get();
    }

    public function iroDocuments(bool $includeArchived = true): Collection
    {
        return Document::query()
            ->select($this->dashboardColumns())
            ->with('department')
            ->when(
                !$includeArchived,
                fn ($query) => $query->where(
                    'status',
                    '!=',
                    Document::STATUS_ARCHIVED
                )
            )
            ->orderByDesc('updated_at')
            ->get();
    }

    public function legalDocuments(Profile $profile): Collection
    {
        return Document::query()
            ->select($this->dashboardColumns())
            ->with('department')
            ->where('assigned_legal_counsel', $profile->id)
            ->orderByDesc('updated_at')
            ->get();
    }

    public function totalUsers(): int
    {
        return Profile::query()->count();
    }

    public function activeUsers(): int
    {
        return Profile::query()
            ->where('is_active', true)
            ->count();
    }

    public function activeDepartments(): int
    {
        return Department::query()->count();
    }

    private function dashboardColumns(): array
    {
        return [
            'id',
            'tracking_number',
            'document_type',
            'partner_institution',
            'department_id',
            'assigned_legal_counsel',
            'status',
            'submitted_at',
            'updated_at',
        ];
    }
}
