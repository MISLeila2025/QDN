<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * "Source of Defect" on the RCA form -- a small, fixed, app-owned lookup
 * (id, defect_source), seeded once by
 * database/migrations/2026_08_24_000001_create_defect_source_table.php
 * with exactly 6 rows: Man / Machine / Materials / Method / Environment /
 * Systems.
 *
 * This used to be planned as a one-time copy of qdn_db.defect_list (see
 * App\Console\Commands\CopyQdnLookupTables) -- that source table was
 * confirmed not to exist ("still dont have defect_list table"), so this
 * is now entirely local to the app and has no connection to qdn_db /
 * tspi_qa at all. Runs on the default connection, same as Qdn /
 * QdnRcaCause.
 */
class Defect extends Model
{
    protected $table = 'defect_source';

    public $timestamps = true;

    protected $guarded = [];

    public const LABEL_COLUMN = 'defect_source';

    public function label(): ?string
    {
        return $this->{self::LABEL_COLUMN} ?? null;
    }

    /**
     * Whether this Source of Defect is "Man" -- the one value that
     * triggers the extra "Issued To" employee-list UI on the RCA form.
     * Matched case-insensitively/trimmed rather than hardcoded to id 1,
     * so it keeps working even if someone re-seeds/reorders the table.
     */
    public function isMan(): bool
    {
        return strcasecmp(trim((string) $this->label()), 'Man') === 0;
    }
}
