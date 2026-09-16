<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One employee added to the "Issued To" list under an RCA cause row whose
 * Source of Defect is "Man". Fields are snapshotted from
 * employee.masterlist at the time they're added (same denormalization
 * pattern as QdnRcaCause::responsible_employee_name, etc.), so the
 * summary table (Emp No / Name / Department / Station / Productline)
 * still renders correctly even if the source employee record later
 * changes.
 */
class QdnRcaCauseEmployee extends Model
{
    protected $table = 'qdn_rca_cause_employees';

    public $timestamps = true;

    protected $guarded = [];

    public function cause(): BelongsTo
    {
        return $this->belongsTo(QdnRcaCause::class, 'qdn_rca_cause_id');
    }
}
