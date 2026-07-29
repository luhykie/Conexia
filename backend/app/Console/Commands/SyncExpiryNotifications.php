<?php

namespace App\Console\Commands;

use App\Services\WorkflowSummaryService;
use Illuminate\Console\Command;

class SyncExpiryNotifications extends Command
{
    protected $signature = 'conexia:sync-expiry-notifications';

    protected $description = 'Create duplicate-safe expiry notifications.';

    public function handle(WorkflowSummaryService $summaries): int
    {
        $result = $summaries->syncExpiryNotifications();

        $this->info(
            'Expiry notifications created: '.($result['created'] ?? 0)
        );

        return self::SUCCESS;
    }
}
