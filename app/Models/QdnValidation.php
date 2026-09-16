<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QdnValidation extends Model
{
    // Default connection, alongside qdns (real FK to qdns.id, same schema).

    protected $fillable = [
        'qdn_id',
        'is_valid',
        'issued_to_employee_id',
        'issued_to_name',
        'department',
        'station',
        'prodline',
        'team',
        'validated_by',
        'validated_at',
        'remarks',
    ];

    protected $casts = [
        'is_valid' => 'boolean',
        'validated_at' => 'datetime',
    ];

    public function qdn(): BelongsTo
    {
        return $this->belongsTo(Qdn::class);
    }
}
