<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Company work-week calendar (qdn_new_db.analog_calendar) -- one row per
 * calendar day, each tagged with its cal_year/cal_quarter/cal_month/
 * cal_workweek. Backs the QDN Records "Work Week" filter: given a
 * (cal_year, cal_workweek) pair, MIN(cal_date)/MAX(cal_date) resolves the
 * actual date range so a QDN's issuance date (qdns.created_at) can be
 * range-checked against it -- see QdnController::records().
 *
 * Read-only from this app's side (rows are maintained elsewhere), so no
 * $fillable/$guarded needed. Uses date_created/date_updated, not Eloquent's
 * default created_at/updated_at, hence $timestamps = false.
 */
class AnalogCalendar extends Model
{
    protected $table = 'analog_calendar';

    public $timestamps = false;
}
