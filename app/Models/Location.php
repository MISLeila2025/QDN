<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Lookup: location_list, copied one-time from qdn_db into your app's
 * default connection (qdn_new_db) via
 * app/Console/Commands/CopyQdnLookupTables.php.
 * Per spec: label column is `location_name`.
 */
class Location extends Model
{

    protected $table = 'location_list';

    public $timestamps = false;

    protected $guarded = [];
}
