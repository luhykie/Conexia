<?php

namespace App\Repositories;

use App\Models\Document;
use App\Models\Profile;
use App\Support\Pagination;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;

class WorkflowSummaryRepository
{
    public function visibleDocuments(
        Profile $profile,
        ?array $options = null,
        bool $expiryOnly = false
    ): Collection|LengthAwarePaginator
    {
        $query = Document::query()
            ->with('department')
            ->when($expiryOnly, fn ($query) =>
                $query->whereNotNull('expiry_date')
            )
            ->when(
                $profile->role === Profile::ROLE_DEPARTMENT_STAFF,
                fn ($query) => $query->where(
                    'department_id',
                    $profile->department_id
                )
            )
            ->when(
                $profile->role === Profile::ROLE_LEGAL_COUNSEL,
                fn ($query) => $query->where(
                    'assigned_legal_counsel',
                    $profile->id
                )
            )
            ->when(
                $profile->role === Profile::ROLE_SUPER_ADMIN,
                fn ($query) => $query->whereRaw('1 = 0')
            )
            ->when(
                ($options['search'] ?? '') !== '',
                fn ($query) => $query->where(function ($builder) use ($options) {
                    $operator = Pagination::searchOperator();

                    $builder
                        ->where('tracking_number', $operator, "%{$options['search']}%")
                        ->orWhere('title', $operator, "%{$options['search']}%")
                        ->orWhere('partner_institution', $operator, "%{$options['search']}%");
                })
            )
            ->when(
                $options['status'] ?? null,
                fn ($query) => $query->where('status', $options['status'])
            )
            ->orderBy(
                $options['sort'] ?? 'updated_at',
                $options['direction'] ?? 'desc'
            );

        if ($options === null) {
            return $query->get();
        }

        return $query->paginate(
            $options['per_page'],
            ['*'],
            'page',
            $options['page']
        );
    }

    public function archivedDocuments(
        ?array $options = null
    ): Collection|LengthAwarePaginator
    {
        $query = Document::query()
            ->with('department')
            ->where('status', Document::STATUS_ARCHIVED)
            ->when(
                ($options['search'] ?? '') !== '',
                fn ($query) => $query->where(function ($builder) use ($options) {
                    $operator = Pagination::searchOperator();

                    $builder
                        ->where('tracking_number', $operator, "%{$options['search']}%")
                        ->orWhere('title', $operator, "%{$options['search']}%")
                        ->orWhere('partner_institution', $operator, "%{$options['search']}%");
                })
            )
            ->orderBy(
                $options['sort'] ?? 'archived_at',
                $options['direction'] ?? 'desc'
            );

        if ($options === null) {
            return $query->get();
        }

        return $query->paginate(
            $options['per_page'],
            ['*'],
            'page',
            $options['page']
        );
    }

    public function reportDocuments(?array $options = null): Collection|LengthAwarePaginator
    {
        $query = Document::query()
            ->with('department')
            ->when(
                ($options['search'] ?? '') !== '',
                fn ($query) => $query->where(function ($builder) use ($options) {
                    $operator = Pagination::searchOperator();

                    $builder
                        ->where('tracking_number', $operator, "%{$options['search']}%")
                        ->orWhere('title', $operator, "%{$options['search']}%")
                        ->orWhere('partner_institution', $operator, "%{$options['search']}%");
                })
            )
            ->when(
                $options['status'] ?? null,
                fn ($query) => $query->where('status', $options['status'])
            )
            ->orderBy(
                $options['sort'] ?? 'updated_at',
                $options['direction'] ?? 'desc'
            );

        if ($options === null) {
            return $query->get();
        }

        return $query->paginate(
            $options['per_page'],
            ['*'],
            'page',
            $options['page']
        );
    }

    public function documentsWithExpiry(): Collection
    {
        return Document::query()
            ->with('department')
            ->whereNotNull('expiry_date')
            ->get();
    }

    public function findVisibleDocumentForUpdate(
        Profile $profile,
        string $documentId
    ): ?Document {
        return Document::query()
            ->whereKey($documentId)
            ->when(
                $profile->role === Profile::ROLE_DEPARTMENT_STAFF,
                fn ($query) => $query->where(
                    'department_id',
                    $profile->department_id
                )
            )
            ->when(
                $profile->role === Profile::ROLE_LEGAL_COUNSEL,
                fn ($query) => $query->where(
                    'assigned_legal_counsel',
                    $profile->id
                )
            )
            ->when(
                $profile->role === Profile::ROLE_SUPER_ADMIN,
                fn ($query) => $query->whereRaw('1 = 0')
            )
            ->lockForUpdate()
            ->first();
    }
}
