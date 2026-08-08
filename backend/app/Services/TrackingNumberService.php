<?php

namespace App\Services;

use App\Models\Document;
use DateTimeInterface;

class TrackingNumberService
{
    public function generateForDate(DateTimeInterface $date): string
    {
        $prefix = 'CONEXIA-'.$date->format('Ymd').'-';

        $latest = Document::query()
            ->where('tracking_number', 'like', $prefix.'%')
            ->orderByDesc('tracking_number')
            ->lockForUpdate()
            ->value('tracking_number');

        $sequence = $latest
            ? ((int) substr($latest, -4)) + 1
            : 1;

        return $prefix.str_pad((string) $sequence, 4, '0', STR_PAD_LEFT);
    }
}
