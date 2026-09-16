<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Lookup: machine_list, copied one-time from qdn_db into your app's
 * default connection (qdn_new_db) via
 * app/Console/Commands/CopyQdnLookupTables.php.
 *
 * ASSUMPTION: label column is `machine_num`. Adjust if your schema differs.
 */
class Machine extends Model
{

    protected $table = 'machine_list';

    public $timestamps = false;

    protected $guarded = [];
}
