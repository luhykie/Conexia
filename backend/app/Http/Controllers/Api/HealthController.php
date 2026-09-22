<?php
// [FEATURE: System Monitoring] - supports platform health and operational monitoring.

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Throwable;

class HealthController extends Controller
{
    // Coordinates key within the platform health and operational monitoring workflow.
    public function __invoke(): JsonResponse
    {
        $database = [
            'connection' => config('database.default'),
            'status' => 'not_checked',
        ];

        try {
            DB::select('select 1');
            $database['status'] = 'ok';
        } catch (Throwable $error) {
            $database['status'] = 'unavailable';
            $database['message'] = $error->getMessage();
        }

        return response()->json([
            'app' => 'CONEXIA Laravel API',
            'status' => 'ok',
            'database' => $database,
        ]);
    }
}
