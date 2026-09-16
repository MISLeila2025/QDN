<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * One row per PE validation decision on a QDN. Lives alongside qdns
     * on the DEFAULT connection (qdn_new_db), so the foreignId constraint
     * below is a real same-schema FK. "Issued To" employee data is still
     * looked up from the separate masterlist connection
     * (employee.masterlist -> EMPLOYID/DEPARTMENT/STATION/PRODLINE/TEAM)
     * and snapshotted here rather than FK'd, since that's a different DB.
     */
    public function up(): void
    {
        Schema::create('qdn_validations', function (Blueprint $table) {
            $table->id();

            $table->foreignId('qdn_id')->constrained('qdns')->cascadeOnDelete();

            $table->boolean('is_valid');

            // Issued To (employee.masterlist)
            $table->string('issued_to_employee_id')->nullable();
            $table->string('issued_to_name')->nullable();
            $table->string('department')->nullable();
            $table->string('station')->nullable();
            $table->string('prodline')->nullable();
            $table->string('team')->nullable();

            $table->string('validated_by')->nullable();
            $table->timestamp('validated_at')->nullable();
            $table->text('remarks')->nullable();

            $table->timestamps();

            $table->index('qdn_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('qdn_validations');
    }
};
