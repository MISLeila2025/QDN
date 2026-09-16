<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One row of the CAPA "Correction Action" repeatable table ("Rework
 * Traveller", only used when qdns.capa_correction_checked is true).
 */
class QdnCapaCorrection extends Model
{
    protected $table = 'qdn_capa_corrections';

    public $timestamps = true;

    protected $guarded = [];

    protected $casts = [
        'work_date' => 'date',
    ];

    public function qdn(): BelongsTo
    {
        return $this->belongsTo(Qdn::class);
    }
}
