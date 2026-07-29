<?php

namespace App\Support;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class Pagination
{
    public const DEFAULT_PER_PAGE = 15;
    public const MAX_PER_PAGE = 100;

    public static function options(
        Request $request,
        array $sortColumns,
        string $defaultSort = 'updated_at',
        array $statusValues = []
    ): array {
        $validated = $request->validate([
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1'],
            'search' => ['nullable', 'string', 'max:100'],
            'status' => [
                'nullable',
                'string',
                'max:100',
                ...($statusValues ? [Rule::in($statusValues)] : []),
            ],
            'sort' => ['nullable', Rule::in($sortColumns)],
            'direction' => ['nullable', Rule::in(['asc', 'desc'])],
        ]);

        return [
            'page' => $validated['page'] ?? 1,
            'per_page' => min(
                $validated['per_page'] ?? self::DEFAULT_PER_PAGE,
                self::MAX_PER_PAGE
            ),
            'search' => trim($validated['search'] ?? ''),
            'status' => $validated['status'] ?? null,
            'sort' => $validated['sort'] ?? $defaultSort,
            'direction' => $validated['direction'] ?? 'desc',
        ];
    }

    public static function meta(LengthAwarePaginator $paginator): array
    {
        return [
            'current_page' => $paginator->currentPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
            'last_page' => $paginator->lastPage(),
            'from' => $paginator->firstItem(),
            'to' => $paginator->lastItem(),
        ];
    }

    public static function searchOperator(): string
    {
        return DB::connection()->getDriverName() === 'pgsql'
            ? 'ilike'
            : 'like';
    }
}
