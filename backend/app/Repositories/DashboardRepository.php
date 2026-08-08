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
        $query = Document::query()
            ->with('department')
            ->orderByDesc('updated_at');

        if ($profile->department_id) {
            return $query
                ->where('department_id', $profile->department_id)
                ->get();
        }

        return $query
            ->where('submitted_by', $profile->id)
            ->get();
    }

    public function iroDocuments(bool $includeArchived = true): Collection
    {
        return Document::query()
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
}
