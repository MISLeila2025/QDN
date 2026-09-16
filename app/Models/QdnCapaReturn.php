<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One "sent back for CAPA rework" log entry -- created whenever Dept
 * Approval marks a CAPA submission Wrong, or QA Verification marks
 * Corrective Action Implemented? No. Exists purely so that history
 * survives even though qdns itself only stores the *current* decision --
 * mirrors the round-tagged qdn_capa_containment_lots /
 * qdn_capa_corrections rows, which likewise keep every round instead of
 * being overwritten on resubmission. See
 * App\Http\Controllers\QdnWorkflowController@approvalStore/qaStore.
 */
class QdnCapaReturn extends Model
{
    protected $table = 'qdn_capa_returns';

    public $timestamps = true;

    protected $guarded = [];

    protected $casts = [
        'returned_at' => 'datetime',
    ];

    public const STAGE_APPROVAL = 'approval';
    public const STAGE_QA = 'qa';

    public function qdn(): BelongsTo
    {
        return $this->belongsTo(Qdn::class);
    }
}
