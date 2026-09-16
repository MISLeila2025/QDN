<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Structured CAPA, replacing the old single `qdns.capa_details`
     * rich-text field with the real form:
     *   1. Containment Action ("Insert 3 lots before and after") --
     *      repeatable rows -> qdn_capa_containment_lots
     *   2. Correction Action ("Rework Traveller") -- repeatable rows ->
     *      qdn_capa_corrections
     *   3. Corrective Action (What/Responsible/When/Status) -- a single
     *      set of fields, not repeatable (no "+ add" mentioned for this
     *      one) -> plain columns on qdns
     * `qdns.capa_details` is left in place but no longer written to.
     *
     * Runs on the default connection.
     */
    public function up(): void
    {
        Schema::table('qdns', function (Blueprint $table) {
            // Section 1 checkbox: "Insert 3 lots before and after"
            $table->boolean('capa_containment_checked')->default(false)->after('capa_details');
            // Section 2 checkbox: "Rework Traveller"
            $table->boolean('capa_correction_checked')->default(false)->after('capa_containment_checked');

            // Section 3: Corrective Action (single set of fields)
            $table->longText('capa_corrective_what')->nullable()->after('capa_correction_checked');
            $table->string('capa_corrective_responsible_employee_id')->nullable()->after('capa_corrective_what');
            $table->string('capa_corrective_responsible_name')->nullable()->after('capa_corrective_responsible_employee_id');
            $table->date('capa_corrective_when')->nullable()->after('capa_corrective_responsible_name');
            $table->enum('capa_corrective_status', ['open', 'done'])->nullable()->after('capa_corrective_when');
        });

        Schema::create('qdn_capa_containment_lots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('qdn_id')->constrained('qdns')->cascadeOnDelete();

            $table->dateTime('date_processed')->nullable();
            $table->string('lot_id')->nullable();
            $table->string('part_name')->nullable();
            $table->unsignedInteger('qty')->nullable();

            // Inspected By: employee.masterlist, JOB_TITLE in ('FVI Inspector 1', 'FVI Inspector 2')
            // ASSUMPTION: masterlist has a JOB_TITLE column -- see Employee model.
            $table->string('inspected_by_employee_id')->nullable();
            $table->string('inspected_by_name')->nullable();

            $table->enum('status', ['open', 'done'])->nullable();
            $table->longText('remarks')->nullable(); // rich text
            $table->string('result_of_inspection')->nullable();

            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index('qdn_id');
        });

        Schema::create('qdn_capa_corrections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('qdn_id')->constrained('qdns')->cascadeOnDelete();

            $table->string('activity')->nullable();
            $table->integer('qty_in')->nullable();
            $table->integer('qty_out')->nullable();

            // Select Operator/FVI/OQA: JOB_TITLE in ('FVI Inspector 1', 'FVI
            // Inspector 2', 'QA Inspector 1', 'QA Inspector 2') OR LIKE '%Operator%'
            $table->string('operator_employee_id')->nullable();
            $table->string('operator_employee_name')->nullable();

            // Select Supervisor: JOB_TITLE LIKE '%Supervisor%'
            $table->string('supervisor_employee_id')->nullable();
            $table->string('supervisor_employee_name')->nullable();

            // Machine No (qdn_db.machine_list)
            $table->unsignedBigInteger('machine_id')->nullable();
            $table->string('machine_num')->nullable();

            $table->date('work_date')->nullable();
            $table->longText('remarks')->nullable(); // rich text

            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index('qdn_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('qdn_capa_corrections');
        Schema::dropIfExists('qdn_capa_containment_lots');

        Schema::table('qdns', function (Blueprint $table) {
            $table->dropColumn([
                'capa_containment_checked',
                'capa_correction_checked',
                'capa_corrective_what',
                'capa_corrective_responsible_employee_id',
                'capa_corrective_responsible_name',
                'capa_corrective_when',
                'capa_corrective_status',
            ]);
        });
    }
};
