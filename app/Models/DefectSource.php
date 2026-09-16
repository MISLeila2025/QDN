<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DefectSource extends Model
{
    // Uses default mysql connection (qdn_new_db) — same as qdn_rca_causes
    protected $table   = 'defect_source';
    protected $guarded = [];

    protected $fillable = ['defect_source'];

    public function label(): string
    {
        return $this->defect_source;
    }
}
