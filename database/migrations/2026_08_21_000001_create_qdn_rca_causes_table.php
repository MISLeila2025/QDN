<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Structured Root Cause Analysis, replacing the old single
     * `qdns.rca_details` rich-text field with the real form: three
     * repeatable groups (Root Cause of Event / Root Cause of Escape /
     * System Cause), each row a Cause (from qdn_db.reason_root_cause) +
     * free-text Cause note + Source of Defect (from qdn_db.defect_list) +
     * Responsible employee (from employee.masterlist, scoped to the QDN's
     * issued_department). `qdns.rca_details` is left in place but no
     * longer written to by QdnWorkflowController -- not dropped, in case
     * you have existing data in it.
     *
     * reason_root_cause_id/defect_id are NOT hard foreign keys, same
     * reasoning as Customer/Machine/etc.: those lookup tables' real
     * primary-key column names/types aren't confirmed yet (see README).
     * responsible_employee_id is the masterlist EMPLOYID (string), also
     * not a hard FK since Employee lives on a different DB connection
     * (masterlist) -- cross-connection FKs aren't possible in MySQL
     * anyway.
     *
     * qdn_id -> qdns.id IS a real FK: both tables live on this app's own
     * default connection.
     *
     * Runs on the default connection.
     */
    public function up(): void
    {
        Schema::create('qdn_rca_causes', function (Blueprint $table) {
            $table->id();

            $table->foreignId('qdn_id')->constrained('qdns')->cascadeOnDelete();

            $table->enum('cause_type', ['event', 'escape', 'system']);

            // Select Cause (qdn_db.reason_root_cause)
            // ASSUMPTION: label column is `root_cause` -- adjust
            // ReasonRootCause::LABEL_COLUMN if your real schema differs.
            $table->unsignedBigInteger('reason_root_cause_id')->nullable();
            $table->string('reason_root_cause_name')->nullable();

            // Cause (free text)
            $table->text('cause')->nullable();

            // Source of Defect (qdn_db.defect_list)
            // ASSUMPTION: label column is `defect_name` -- adjust
            // Defect::LABEL_COLUMN if your real schema differs.
            $table->unsignedBigInteger('defect_id')->nullable();
            $table->string('defect_name')->nullable();

            // Select Responsible (employee.masterlist, IssuedTo Department)
            $table->string('responsible_employee_id')->nullable();
            $table->string('responsible_employee_name')->nullable();

            $table->unsignedInteger('sort_order')->default(0);

            $table->timestamps();

            $table->index(['qdn_id', 'cause_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('qdn_rca_causes');
    }
};
