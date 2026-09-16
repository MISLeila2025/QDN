<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Expands the QDN workflow past PE's initial valid/invalid decision
     * into the full disposition flow you described:
     *   pending_pe -> for_dept_rca -> for_pe_rca_validation -> for_dept_capa
     *   -> for_dept_approval -> for_qa_verification -> closed
     * (or invalid, at the very first PE decision)
     *
     * 'issued' is kept in the enum for backward compatibility with any row
     * already in that state on your existing data -- new QDNs marked valid
     * now move straight to 'for_dept_rca' instead (see
     * PeValidationController@store).
     *
     * The status column is a MySQL ENUM, so widening it needs a raw
     * MODIFY COLUMN statement -- Blueprint::enum()->change() would need
     * doctrine/dbal, which this project deliberately avoids (see the
     * system_status.message nullable fix from earlier).
     *
     * Runs on the default connection, same as the qdns table itself.
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
            "'closed'" .
            ") NOT NULL DEFAULT 'pending_pe'"
        );

        Schema::table('qdns', function (Blueprint $table) {
            // Dept RCA (Root Cause Analysis) -- rich-text, same pattern as
            // the original "details" field.
            $table->longText('rca_details')->nullable()->after('issued_department');
            $table->string('rca_submitted_by')->nullable()->after('rca_details');
            $table->dateTime('rca_submitted_at')->nullable()->after('rca_submitted_by');

            // PE Validation of RCA
            $table->string('rca_validated_by')->nullable()->after('rca_submitted_at');
            $table->dateTime('rca_validated_at')->nullable()->after('rca_validated_by');
            $table->text('rca_validation_remarks')->nullable()->after('rca_validated_at');

            // Department CAPA (Corrective & Preventive Action)
            $table->longText('capa_details')->nullable()->after('rca_validation_remarks');
            $table->string('capa_submitted_by')->nullable()->after('capa_details');
            $table->dateTime('capa_submitted_at')->nullable()->after('capa_submitted_by');

            // Dept Approval of CAPA
            $table->string('capa_approved_by')->nullable()->after('capa_submitted_at');
            $table->dateTime('capa_approved_at')->nullable()->after('capa_approved_by');
            $table->text('capa_approval_remarks')->nullable()->after('capa_approved_at');

            // QA Verification
            $table->string('qa_verified_by')->nullable()->after('capa_approval_remarks');
            $table->dateTime('qa_verified_at')->nullable()->after('qa_verified_by');
            $table->text('qa_verification_remarks')->nullable()->after('qa_verified_at');
            // Not re-indexing issued_department here -- the
            // 2026_08_18_000003 migration already added ->index() to it.
        });
    }

    public function down(): void
    {
        Schema::table('qdns', function (Blueprint $table) {
            $table->dropColumn([
                'rca_details', 'rca_submitted_by', 'rca_submitted_at',
                'rca_validated_by', 'rca_validated_at', 'rca_validation_remarks',
                'capa_details', 'capa_submitted_by', 'capa_submitted_at',
                'capa_approved_by', 'capa_approved_at', 'capa_approval_remarks',
                'qa_verified_by', 'qa_verified_at', 'qa_verification_remarks',
            ]);
        });

        DB::statement(
            "ALTER TABLE `qdns` MODIFY `status` ENUM('pending_pe', 'issued', 'invalid') NOT NULL DEFAULT 'pending_pe'"
        );
    }
};
