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
                fn ($query) => $query->where(function ($builder) use ($options, $profile) {
                    $operator = Pagination::searchOperator();

                    $builder->where(
                        'tracking_number',
                        $operator,
                        "%{$options['search']}%"
                    );

                    $builder
                        ->orWhere('title', $operator, "%{$options['search']}%")
                        ->orWhere('partner_institution', $operator, "%{$options['search']}%");

                    $builder->orWhereHas(
                        'department',
                        fn ($departmentQuery) => $departmentQuery
                            ->where('code', $operator, "%{$options['search']}%")
                            ->orWhere('name', $operator, "%{$options['search']}%")
                    );
                })
            )
            ->when(
                $options['status'] ?? null,
                fn ($query) => $query->where('status', $options['status'])
            )
            ->when(
                $options['partnership_scope'] ?? null,
                fn ($query) => $query->where(
                    'partnership_scope',
                    $options['partnership_scope']
                )
            )
            ->when(
                $options['document_type'] ?? null,
                fn ($query) => $query->where(
                    'document_type',
                    $options['document_type']
                )
            )
            ->when(
                $options['department'] ?? null,
                fn ($query) => $query->whereHas(
                    'department',
                    fn ($departmentQuery) => $departmentQuery
                        ->where('code', $options['department'])
                        ->orWhere('name', $options['department'])
                )
            )
            ->when(
                $options['renewal_filter'] ?? null,
                fn ($query) => $this->applyRenewalFilter(
                    $query,
                    $options['renewal_filter']
                )
            )
            ->when(
                $options['expiry_window'] ?? null,
                fn ($query) => $this->applyExpiryWindow(
                    $query,
                    $options['expiry_window']
                )
            )
            ->orderBy(
                $options['sort'] ?? 'updated_at',
                $options['direction'] ?? 'desc'
            );

        if ($options === null || ($options['paginate'] ?? true) === false) {
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
            ->whereIn('status', [
                Document::STATUS_APPROVED,
                Document::STATUS_ARCHIVED,
            ])
            ->when(
                $options['status'] ?? null,
                fn ($query) => $query->where('status', $options['status'])
            )
            ->when(
                ($options['search'] ?? '') !== '',
                fn ($query) => $query->where(function ($builder) use ($options) {
                    $operator = Pagination::searchOperator();

                    $builder
                        ->where('tracking_number', $operator, "%{$options['search']}%")
                        ->orWhere('title', $operator, "%{$options['search']}%")
                        ->orWhere('partner_institution', $operator, "%{$options['search']}%")
                        ->orWhereHas(
                            'department',
                            fn ($departmentQuery) => $departmentQuery
                                ->where('code', $operator, "%{$options['search']}%")
                                ->orWhere('name', $operator, "%{$options['search']}%")
                        );
                })
            )
            ->when(
                $options['document_type'] ?? null,
                fn ($query) => $query->where(
                    'document_type',
                    $options['document_type']
                )
            )
            ->when(
                $options['department'] ?? null,
                fn ($query) => $query->whereHas(
                    'department',
                    fn ($departmentQuery) => $departmentQuery
                        ->where('code', $options['department'])
                        ->orWhere('name', $options['department'])
                )
            )
            ->when(
                $options['date_from'] ?? null,
                fn ($query) => $query->where(function ($dateQuery) use ($options) {
                    $dateQuery
                        ->where(fn ($statusQuery) => $statusQuery
                            ->where('status', Document::STATUS_ARCHIVED)
                            ->whereDate('archived_at', '>=', $options['date_from']))
                        ->orWhere(fn ($statusQuery) => $statusQuery
                            ->where('status', Document::STATUS_APPROVED)
                            ->whereDate('updated_at', '>=', $options['date_from']));
                })
            )
            ->when(
                $options['date_to'] ?? null,
                fn ($query) => $query->where(function ($dateQuery) use ($options) {
                    $dateQuery
                        ->where(fn ($statusQuery) => $statusQuery
                            ->where('status', Document::STATUS_ARCHIVED)
                            ->whereDate('archived_at', '<=', $options['date_to']))
                        ->orWhere(fn ($statusQuery) => $statusQuery
                            ->where('status', Document::STATUS_APPROVED)
                            ->whereDate('updated_at', '<=', $options['date_to']));
                })
            )
            ->when(
                $options['partnership_scope'] ?? null,
                fn ($query) => $query->where(
                    'partnership_scope',
                    $options['partnership_scope']
                )
            )
            ->orderBy(
                $options['sort'] ?? 'updated_at',
                $options['direction'] ?? 'desc'
            );

        if ($options === null || ($options['paginate'] ?? true) === false) {
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
            ->whereNotIn('status', [
                Document::STATUS_PENDING_NOTARIZATION,
                Document::STATUS_NOTARIZED,
            ])
            ->when(
                ($options['search'] ?? '') !== '',
                fn ($query) => $query->where(function ($builder) use ($options) {
                    $operator = Pagination::searchOperator();

                    $builder
                        ->where('tracking_number', $operator, "%{$options['search']}%")
                        ->orWhere('title', $operator, "%{$options['search']}%")
                        ->orWhere('partner_institution', $operator, "%{$options['search']}%")
                        ->orWhereHas(
                            'department',
                            fn ($departmentQuery) => $departmentQuery
                                ->where('code', $operator, "%{$options['search']}%")
                                ->orWhere('name', $operator, "%{$options['search']}%")
                        );
                })
            )
            ->when(
                $options['document_type'] ?? null,
                fn ($query) => $query->where(
                    'document_type',
                    $options['document_type']
                )
            )
            ->when(
                $options['department'] ?? null,
                fn ($query) => $query->whereHas(
                    'department',
                    fn ($departmentQuery) => $departmentQuery
                        ->where('code', $options['department'])
                        ->orWhere('name', $options['department'])
                )
            )
            ->when(
                $options['date_from'] ?? null,
                fn ($query) => $query->whereDate(
                    'submitted_at',
                    '>=',
                    $options['date_from']
                )
            )
            ->when(
                $options['date_to'] ?? null,
                fn ($query) => $query->whereDate(
                    'submitted_at',
                    '<=',
                    $options['date_to']
                )
            )
            ->when(
                $options['status'] ?? null,
                fn ($query) => $query->where('status', $options['status'])
            )
            ->when(
                $options['partnership_scope'] ?? null,
                fn ($query) => $query->where(
                    'partnership_scope',
                    $options['partnership_scope']
                )
            )
            ->orderBy(
                $options['sort'] ?? 'updated_at',
                $options['direction'] ?? 'desc'
            );

        if ($options === null || ($options['paginate'] ?? true) === false) {
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

    private function applyRenewalFilter($query, string $filter): void
    {
        if ($filter === 'Renewal Required') {
            $query->whereIn('renewal_status', [
                Document::RENEWAL_DUE,
                Document::RENEWAL_REQUESTED,
            ]);

            return;
        }

        if ($filter === 'Expired') {
            $query->where(function ($builder) {
                $builder
                    ->where('renewal_status', Document::RENEWAL_EXPIRED)
                    ->orWhereDate('expiry_date', '<', now()->toDateString());
            });

            return;
        }

        $renewalStatus = [
            'Active' => Document::RENEWAL_ACTIVE,
            'Renewed' => Document::RENEWAL_RENEWED,
        ][$filter] ?? null;

        if ($renewalStatus) {
            $query->where('renewal_status', $renewalStatus);

            if ($filter === 'Active') {
                $query->whereDate(
                    'expiry_date',
                    '>=',
                    now()->toDateString()
                );
            }
        }
    }

    private function applyExpiryWindow($query, string $window): void
    {
        if ($window === 'expired') {
            $query->whereDate('expiry_date', '<', now()->toDateString());

            return;
        }

        $query
            ->whereDate('expiry_date', '>=', now()->toDateString())
            ->whereDate(
                'expiry_date',
                '<=',
                now()->addDays((int) $window)->toDateString()
            );
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
