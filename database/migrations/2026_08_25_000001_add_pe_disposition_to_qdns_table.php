<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * "PE Disposition" -- the page PE lands on after a department submits
     * RCA (status for_pe_rca_validation), replacing the old generic
     * approve/reject decision there. PE picks exactly one of six outcomes:
     * Rework / Split Lot / Shutdown / Shipback / Use As Is / Invalid.
     *
     *   - Rework, Split Lot, Shutdown, Shipback, Use As Is: QDN returns to
     *     the issuing department for CAPA (status -> for_dept_capa), same
     *     destination the old "approve" outcome used.
     *   - Invalid: QDN closes right here (status -> invalid_disposition)
     *     rather than continuing to CAPA -- but it's NOT deleted or hidden,
     *     it stays fully visible in QDN Records / the department's history,
     *     same as every other terminal status. Deliberately a distinct
     *     status from the existing STATUS_INVALID (which means PE rejected
     *     it at the very first pending_pe step, before any department ever
     *     saw it) -- "invalid after RCA" and "invalid before RCA" are
     *     different events worth telling apart in the records list.
     *
     * The status column is a MySQL ENUM, so widening it needs a raw MODIFY
     * COLUMN statement -- Blueprint::enum()->change() would need
     * doctrine/dbal, which this project deliberately avoids (same reason
     * as the 2026_08_20_000001 migration). pe_disposition itself is a
     * brand new column, so it can use Blueprint::enum() directly --
     * doctrine/dbal is only required for ->change() on an *existing*
     * column, not for adding a new one.
     */
    public function up(): void
    {
        DB::statement(
            "ALTER TABLE `qdns` MODIFY `status` ENUM(" .
            "'pending_pe'," .
            "'issued'," .
            "'invalid'," .
            "'for_dept_rca'," .
            "'for_pe_rca_validation'," .
            "'for_dept_capa'," .
            "'for_dept_approval'," .
            "'for_qa_verification'," .
            "'closed'," .
            "'invalid_disposition'" .
            ") NOT NULL DEFAULT 'pending_pe'"
        );

        Schema::table('qdns', function (Blueprint $table) {
            $table->enum('pe_disposition', [
                'rework', 'split_lot', 'shutdown', 'shipback', 'use_as_is', 'invalid',
            ])->nullable()->after('rca_validation_remarks');
            $table->text('pe_disposition_remarks')->nullable()->after('pe_disposition');
            $table->string('pe_disposition_by')->nullable()->after('pe_disposition_remarks');
            $table->dateTime('pe_disposition_at')->nullable()->after('pe_disposition_by');
        });
    }

    public function down(): void
    {
        Schema::table('qdns', function (Blueprint $table) {
            $table->dropColumn(['pe_disposition', 'pe_disposition_remarks', 'pe_disposition_by', 'pe_disposition_at']);
        });

        DB::statement(
            "ALTER TABLE `qdns` MODIFY `status` ENUM(" .
            "'pending_pe','issued','invalid','for_dept_rca','for_pe_rca_validation'," .
            "'for_dept_capa','for_dept_approval','for_qa_verification','closed'" .
            ") NOT NULL DEFAULT 'pending_pe'"
        );
    }
};
