<?php

namespace App\Services;

use App\Models\Qdn;
use Illuminate\Support\Facades\DB;

/**
 * Generates the auto QDN No in the format yyyy-xxxxxxx, e.g. 2026-0000001.
 * The 7-digit sequence resets every calendar year.
 *
 * Generation happens inside store() (not on the create form's initial
 * GET) so an abandoned form doesn't burn a number, and we lock the row
 * set for the current year to avoid a race between two people submitting
 * at the same moment.
 */
class QdnNumberGenerator
{
    public static function next(): string
    {
        $year = now()->year;

        // qdns lives on the default connection (qdn_new_db), same as
        // this DB::transaction() call, so no explicit connection() needed.
        return DB::transaction(function () use ($year) {
            $prefix = $year . '-';

            $lastNumber = Qdn::where('qdn_no', 'like', $prefix . '%')
                ->lockForUpdate()
                ->orderByDesc('qdn_no')
                ->value('qdn_no');

            $nextSequence = $lastNumber
                ? ((int) substr($lastNumber, 5)) + 1
                : 1;

            return $prefix . str_pad((string) $nextSequence, 7, '0', STR_PAD_LEFT);
        });
    }
}
