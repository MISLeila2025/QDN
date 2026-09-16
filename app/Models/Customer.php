<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Lookup: customer_list, copied one-time from qdn_db into your app's
 * default connection (qdn_new_db, via DB_DATABASE) using
 * app/Console/Commands/CopyQdnLookupTables.php. No longer read live from
 * qdn_db -- re-run that command to refresh.
 *
 * No explicit $connection property -- uses the default connection, same
 * as everything else in this app now.
 *
 * ASSUMPTION: column is `customer_name` — the spec only says "Customer -
 * dropdown list fetch from qdn_db.customer_list" without naming the label
 * column. Rename below to match your actual schema if different.
 */
class Customer extends Model
{

    protected $table = 'customer_list';

    public $timestamps = false;

    protected $guarded = [];
}
