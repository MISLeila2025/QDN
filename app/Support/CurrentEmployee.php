<?php

namespace App\Support;

/**
 * Resolves the logged-in user's identity for the current request, per
 * App\Http\Middleware\AuthMiddleware -- your authify SSO doesn't touch
 * Laravel's Auth facade at all; it writes everything to
 * session('emp_data') as a plain array:
 *
 *   session('emp_data') = [
 *       'token', 'emp_id', 'emp_name', 'emp_firstname', 'emp_jobtitle',
 *       'emp_dept', 'emp_prodline', 'emp_station', 'emp_position',
 *       'generated_at',
 *   ]
 *
 * This does NOT hit the masterlist connection/DB -- department, station,
 * etc. for the CURRENT user are already in session courtesy of
 * AuthMiddleware's authify_sessions lookup, so there's no need to query
 * employee.masterlist just to find out who's logged in. (masterlist is
 * still used elsewhere -- see app/Models/Employee.php -- for looking up
 * an arbitrary *other* employee, e.g. the "Issued To" person on a QDN.)
 */
class CurrentEmployee
{
    public static function data(): ?array
    {
        return session('emp_data');
    }

    public static function employId(): ?string
    {
        return session('emp_data.emp_id');
    }

    public static function name(): ?string
    {
        return session('emp_data.emp_name');
    }

    public static function department(): ?string
    {
        return session('emp_data.emp_dept');
    }

    public static function station(): ?string
    {
        return session('emp_data.emp_station');
    }

    public static function prodline(): ?string
    {
        return session('emp_data.emp_prodline');
    }

    public static function jobTitle(): ?string
    {
        return session('emp_data.emp_jobtitle');
    }

    /**
     * Case-insensitive substring match against the current employee's job
     * title -- same case-insensitivity reasoning as isInDepartment()
     * above (title casing isn't guaranteed consistent either). $needles
     * are substrings, not exact titles -- e.g. 'Manager' matches
     * "Production Manager", "Senior Manager", "Manager - MIS/Facilities",
     * etc.
     *
     * ASSUMPTION: session('emp_data.emp_jobtitle') carries the same text
     * as employee.masterlist.JOB_TITLE (confirmed via a real DISTINCT
     * JOB_TITLE query, but emp_jobtitle itself comes from your authify
     * SSO, a separate system per the class docblock above -- not
     * cross-checked against masterlist). If gating doesn't work as
     * expected, dump session('emp_data') for a logged-in Supervisor/
     * Section Head/Manager and compare emp_jobtitle's exact text against
     * the JOB_TITLE list already confirmed.
     */
    public static function jobTitleContainsAny(array $needles): bool
    {
        $title = static::jobTitle();
        if (!$title) {
            return false;
        }

        foreach ($needles as $needle) {
            if (stripos($title, $needle) !== false) {
                return true;
            }
        }

        return false;
    }

    // "Supervisor and Up" -- required to submit Dept RCA / Dept CAPA (per
    // the user: "RCA and CAPA can only answer by Supervisor, Section, and
    // Manager"). Confirmed against a real DISTINCT JOB_TITLE query --
    // every Section Head / Section Manager title also contains "Manager"
    // or "Section Head", so these three substrings cover the full set
    // without needing an exhaustive exact-match list.
    public const SUPERVISOR_AND_UP_TITLES = ['Supervisor', 'Section Head', 'Manager'];

    // Dept Approval's Correct/Wrong decision is narrower -- Section Head
    // and Manager only, NOT plain Supervisor (per the user, explicitly:
    // "Approver should be Section Head and Manager").
    public const APPROVER_TITLES = ['Section Head', 'Manager'];

    public static function isSupervisorAndUp(): bool
    {
        return static::jobTitleContainsAny(self::SUPERVISOR_AND_UP_TITLES);
    }

    public static function isApprover(): bool
    {
        return static::jobTitleContainsAny(self::APPROVER_TITLES);
    }

    /**
     * Trimmed + case-insensitive on purpose -- department names come from
     * two different sources that don't necessarily agree on casing
     * (session('emp_data.emp_dept') vs. employee.masterlist.DEPARTMENT),
     * and an exact === match has already broken once on this app (the
     * real PE department name turned out to be "Process Engineering",
     * not "PE" -- see DEPARTMENT_PE below).
     */
    public static function isInDepartment(string $department): bool
    {
        $current = static::department();

        return $current !== null && strcasecmp(trim($current), trim($department)) === 0;
    }

    /**
     * Same as isInDepartment(), but true if the current department matches
     * ANY of the given names -- needed because "QA" turned out to map to
     * two distinct real department names, not one (see DEPARTMENT_QA).
     */
    public static function isInAnyDepartment(array $departments): bool
    {
        foreach ($departments as $department) {
            if (static::isInDepartment($department)) {
                return true;
            }
        }

        return false;
    }

    // The literal "PE" from the original spec turned out to be shorthand,
    // not the real stored value -- confirmed via a logged-in PE
    // employee's actual session('emp_data.emp_dept').
    public const DEPARTMENT_PE = 'Process Engineering';

    // Likewise "QA" -- confirmed to cover two distinct real department
    // names, both treated as QA for QA Verification purposes.
    public const DEPARTMENT_QA = ['Quality Assurance', 'Quality Management System'];

    public static function isPe(): bool
    {
        return static::isInDepartment(self::DEPARTMENT_PE);
    }

    public static function isQa(): bool
    {
        return static::isInAnyDepartment(self::DEPARTMENT_QA);
    }
}
