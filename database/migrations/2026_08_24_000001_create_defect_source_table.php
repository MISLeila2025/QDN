<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * "Source of Defect" on the RCA form used to be planned as a copy of
     * qdn_db.defect_list (via CopyQdnLookupTables) -- that source table
     * turned out not to exist ("still dont have defect_list table"), so
     * this is now a small app-owned static lookup instead: just an id +
     * label, seeded once with the 6 fixed values below. No connection to
     * qdn_db/tspi_qa at all.
     *
     * Runs on the default connection (same as qdn_rca_causes, qdns, etc.).
     */
    public function up(): void
    {
        Schema::create('defect_source', function (Blueprint $table) {
            $table->id();
            $table->string('defect_source');
            $table->timestamps();
        });

        // Fixed order per spec: 1 Man, 2 Machine, 3 Materials, 4 Method,
        // 5 Environment, 6 Systems. Inserted with explicit ids so
        // "Man" is always id 1 -- App\Models\Defect::isMan() also checks
        // by label (case-insensitive), so this ordering is a convenience,
        // not a hard dependency.
        DB::table('defect_source')->insert([
            ['id' => 1, 'defect_source' => 'Man', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 2, 'defect_source' => 'Machine', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 3, 'defect_source' => 'Materials', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 4, 'defect_source' => 'Method', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 5, 'defect_source' => 'Environment', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 6, 'defect_source' => 'Systems', 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('defect_source');
    }
};
