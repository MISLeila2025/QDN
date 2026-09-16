<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * "Issued To" list attached to one RCA cause row, only ever populated
     * when that row's Source of Defect is "Man" (see
     * App\Models\Defect::isMan() / QdnWorkflowController::syncRcaCauses()).
     * One qdn_rca_causes row can have many employees added via the
     * "+ Add to list" button on the RCA form; summary columns match the
     * spec exactly: Emp No / Name / Department / Station / Productline.
     *
     * employee_id is the employee.masterlist EMPLOYID (string) -- same as
     * responsible_employee_id on qdn_rca_causes, not a hard FK since
     * Employee lives on a different DB connection (masterlist).
     *
     * qdn_rca_cause_id -> qdn_rca_causes.id IS a real FK: both tables live
     * on this app's own default connection.
     */
    public function up(): void
    {
        Schema::create('qdn_rca_cause_employees', function (Blueprint $table) {
            $table->id();

            $table->foreignId('qdn_rca_cause_id')->constrained('qdn_rca_causes')->cascadeOnDelete();

            $table->string('employee_id');
            $table->string('employee_name')->nullable();
            $table->string('department')->nullable();
            $table->string('station')->nullable();
            $table->string('prodline')->nullable();

            $table->unsignedInteger('sort_order')->default(0);

            $table->timestamps();

            $table->index('qdn_rca_cause_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('qdn_rca_cause_employees');
    }
};
