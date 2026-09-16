<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Adds the real columns your database already has (confirmed via
     * `DESCRIBE qdn_rca_causes`): defect_source_id / defect_source_name
     * (the "Source of Defect" pick, now pointing at the app-owned
     * defect_source table instead of the old defect_id/defect_name pair,
     * which are left in place unused) and issued_to (a JSON list of
     * employees, only ever populated when defect_source resolves to
     * "Man" -- see App\Models\Defect::isMan() /
     * QdnWorkflowController::syncRcaCauses()).
     *
     * Every column is added conditionally (Schema::hasColumn) so this is
     * safe to run even though your database already has them by hand --
     * it's a no-op there, and creates them correctly on any other
     * environment (fresh install, staging, etc.).
     */
    public function up(): void
    {
        Schema::table('qdn_rca_causes', function (Blueprint $table) {
            if (!Schema::hasColumn('qdn_rca_causes', 'defect_source_id')) {
                $table->unsignedBigInteger('defect_source_id')->nullable()->after('defect_name');
            }
            if (!Schema::hasColumn('qdn_rca_causes', 'defect_source_name')) {
                $table->string('defect_source_name')->nullable()->after('defect_source_id');
            }
            if (!Schema::hasColumn('qdn_rca_causes', 'issued_to')) {
                $table->json('issued_to')->nullable()->after('defect_source_name');
            }
        });
    }

    public function down(): void
    {
        Schema::table('qdn_rca_causes', function (Blueprint $table) {
            foreach (['defect_source_id', 'defect_source_name', 'issued_to'] as $column) {
                if (Schema::hasColumn('qdn_rca_causes', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
