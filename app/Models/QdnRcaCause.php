<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One row of structured RCA data -- Root Cause of Event / Root Cause of
 * Escape / System Cause all share this table, distinguished by
 * cause_type. See QdnWorkflowController@rcaStore for how the three
 * repeatable groups on the RCA form map onto rows here.
 *
 * "Source of Defect" is defect_source_id/defect_source_name (pointing at
 * App\Models\Defect / the defect_source table) -- the older
 * defect_id/defect_name columns are left in place, unused.
 *
 * "Issued To" (issued_to) is a JSON list of employees, stored directly on
 * this row rather than a separate child table -- only ever populated when
 * defect_source resolves to "Man" (see App\Models\Defect::isMan() /
 * QdnWorkflowController::syncRcaCauses()). Each entry:
 * {employee_id, employee_name, department, station, prodline}.
 */
class QdnRcaCause extends Model
{
    protected $table = 'qdn_rca_causes';

    public $timestamps = true;

    protected $guarded = [];

    protected $casts = [
        'issued_to' => 'array',
    ];

    public const TYPE_EVENT = 'event';
    public const TYPE_ESCAPE = 'escape';
    public const TYPE_SYSTEM = 'system';

    public function qdn(): BelongsTo
    {
        return $this->belongsTo(Qdn::class);
    }
}
