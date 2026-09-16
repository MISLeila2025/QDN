<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Read-only lookup: employee_masterlist (connection: masterlist ->
 * tspi_hr_db per your .env). Columns per spec: EMPLOYID, DEPARTMENT,
 * STATION, PRODLINE, TEAM.
 *
 * Confirmed real table name: employee_masterlist (the earlier guess of
 * `masterlist` threw "Base table or view not found").
 */
class Employee extends Model
{
    protected $connection = 'masterlist';

    protected $table = 'employee_masterlist';

    protected $primaryKey = 'EMPLOYID';

    public $incrementing = false;

    protected $keyType = 'string';

    public $timestamps = false;

    protected $guarded = [];

    /**
     * The real display-name column is EMPNAME, not EMPLOYNAME -- confirmed
     * via a real `DESCRIBE employee_masterlist` from the user
     * (EMPLOYNAME was an unconfirmed guess that had been carried through
     * every controller/JS file in this feature). Rather than rename every
     * one of those call sites, this model exposes EMPNAME as a virtual
     * EMPLOYNAME attribute -- both in PHP (`$employee->EMPLOYNAME`) and in
     * JSON (`$appends`, so EmployeeSearchController's response still has
     * an `EMPLOYNAME` key for the frontend). Every query below that used
     * to select 'EMPLOYNAME' now selects the real 'EMPNAME' column so
     * this accessor has something to read.
     *
     * Named getEMPLOYNAMEAttribute (not the studly-cased
     * getEmployNameAttribute Laravel's docs usually show) because PHP
     * method names are case-insensitive, and that's the exact string
     * Eloquent's magic accessor lookup builds for an all-caps,
     * no-underscore attribute key like 'EMPLOYNAME'.
     */
    protected $appends = ['EMPLOYNAME'];

    public function getEMPLOYNAMEAttribute()
    {
        return $this->attributes['EMPNAME'] ?? null;
    }

    /**
     * "Select Responsible" on the RCA form / Corrective Action step, and
     * also the "Issued To" employee picker for RCA cause rows whose
     * Source of Defect is "Man" -- both draw from every employee in the
     * QDN's issued_department. STATION/PRODLINE are pulled too (not just
     * EMPLOYID/EMPLOYNAME/DEPARTMENT) since the "Issued To" summary table
     * needs to show Station and Productline per spec.
     */
    public static function inDepartment(?string $department)
    {
        if (!$department) {
            return collect();
        }

        return static::where('DEPARTMENT', $department)
            ->orderBy('EMPNAME')
            ->get(['EMPLOYID', 'EMPNAME', 'DEPARTMENT', 'STATION', 'PRODLINE']);
    }

    /**
     * "Inspected By" / "Select Operator/FVI/OQA" / "Select Supervisor" on
     * the CAPA form -- filtered by JOB_TITLE, either an exact list
     * (`$titles`, e.g. ['FVI Inspector 1', 'FVI Inspector 2']) or a set of
     * SQL LIKE patterns (`$likePatterns`, e.g. ['%Supervisor%']), or both
     * combined with OR.
     *
     * ASSUMPTION: employee.masterlist has a JOB_TITLE column -- the
     * original spec never named it explicitly for this table (only
     * AuthMiddleware's session data has `emp_jobtitle`), so this is a
     * guess based on the DEPARTMENT/STATION/PRODLINE/TEAM naming
     * convention already confirmed elsewhere on this model. Run
     * `DESCRIBE masterlist;` and adjust JOB_TITLE_COLUMN below if it's
     * named differently.
     */
    public const JOB_TITLE_COLUMN = 'JOB_TITLE';

    public static function withJobTitles(array $titles = [], array $likePatterns = [])
    {
        if (empty($titles) && empty($likePatterns)) {
            return collect();
        }

        return static::where(function ($query) use ($titles, $likePatterns) {
            if (!empty($titles)) {
                $query->orWhereIn(self::JOB_TITLE_COLUMN, $titles);
            }
            foreach ($likePatterns as $pattern) {
                $query->orWhere(self::JOB_TITLE_COLUMN, 'like', $pattern);
            }
        })
            ->orderBy('EMPNAME')
            ->get(['EMPLOYID', 'EMPNAME', self::JOB_TITLE_COLUMN]);
    }
}
