<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One row of the CAPA "Containment Action" repeatable lot table (only
 * used when qdns.capa_containment_checked is true).
 */
class QdnCapaContainmentLot extends Model
{
    protected $table = 'qdn_capa_containment_lots';

    public $timestamps = true;

    protected $guarded = [];

    protected $casts = [
        'date_processed' => 'datetime',
    ];

    public function qdn(): BelongsTo
    {
        return $this->belongsTo(Qdn::class);
    }
}
