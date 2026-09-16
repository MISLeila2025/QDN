<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Lookup: reason_root_cause, copied one-time from qdn_db (connection:
 * tspi_qa) into your app's default connection via
 * app/Console/Commands/CopyQdnLookupTables.php -- same pattern as
 * Customer/Machine/Location/Nonconformity/Package.
 *
 * ASSUMPTION: the label column is `root_cause` -- I don't know your real
 * reason_root_cause schema. If dropdowns come back blank after copying
 * this table, run `DESCRIBE reason_root_cause;` and update LABEL_COLUMN
 * below to match.
 */
class ReasonRootCause extends Model
{
    protected $table = 'reason_root_cause';

    public $timestamps = false;

    protected $guarded = [];

    public const LABEL_COLUMN = 'root_cause';

    public function label(): ?string
    {
        return $this->{self::LABEL_COLUMN} ?? null;
    }
}
