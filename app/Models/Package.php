<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Lookup: package_list, copied one-time from qdn_db into your app's
 * default connection (qdn_new_db) via
 * app/Console/Commands/CopyQdnLookupTables.php.
 * Per spec: devicename -> package_type
 */
class Package extends Model
{

    protected $table = 'package_list';

    public $timestamps = false;

    protected $guarded = [];

    /**
     * Find the package_type for a given device name.
     */
    public static function typeForDevice(string $deviceName): ?string
    {
        return static::where('devicename', $deviceName)->value('package_type');
    }
}
