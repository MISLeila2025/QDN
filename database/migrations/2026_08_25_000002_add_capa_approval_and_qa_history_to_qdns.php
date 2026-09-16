<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Dept Approval (Correct/Wrong) + QA Verification (Corrective Action
     * Implemented? Yes/No + Verification of Effectiveness) + CAPA history
     * across "returned for update" rounds.
     *
     * History design: qdns.capa_round is a pointer -- "which round of
     * Containment/Correction rows is currently being worked on / was last
     * submitted." QdnWorkflowController@capaStore tags every row it
     * inserts with the round number *at the time of that submission* and
     * only ever deletes/replaces rows belonging to that same round, so
     * every prior round's rows stay in the table untouched. Dept Approval
     * "Wrong" and QA "No" both log a qdn_capa_returns row (who returned
     * it, when, why, which round) and bump capa_round so the next
     * submission lands as a new round instead of overwriting history --
     * see QdnDetailCard's CAPA history section for how it's displayed.
     *
     * All idempotent (Schema::hasColumn/hasTable guarded) since this app's
     * schema is sometimes created/altered by hand ahead of migrations.
     */
    public function up(): void
    {
        Schema::table('qdns', function (Blueprint $table) {
            if (!Schema::hasColumn('qdns', 'capa_round')) {
                $table->unsignedInteger('capa_round')->default(1)->after('capa_corrective_status');
            }
            if (!Schema::hasColumn('qdns', 'capa_approval_status')) {
                $table->enum('capa_approval_status', ['correct', 'wrong'])->nullable()->after('capa_approval_remarks');
            }
            if (!Schema::hasColumn('qdns', 'qa_capa_implemented')) {
                $table->enum('qa_capa_implemented', ['yes', 'no'])->nullable()->after('qa_verification_remarks');
            }
        });

        if (!Schema::hasColumn('qdn_capa_containment_lots', 'round')) {
            Schema::table('qdn_capa_containment_lots', function (Blueprint $table) {
                $table->unsignedInteger('round')->default(1)->after('qdn_id');
            });
        }

        if (!Schema::hasColumn('qdn_capa_corrections', 'round')) {
            Schema::table('qdn_capa_corrections', function (Blueprint $table) {
                $table->unsignedInteger('round')->default(1)->after('qdn_id');
            });
        }

        if (!Schema::hasTable('qdn_capa_returns')) {
            Schema::create('qdn_capa_returns', function (Blueprint $table) {
                $table->id();
                $table->foreignId('qdn_id')->constrained('qdns')->cascadeOnDelete();
                // Which CAPA round this return applies to (the round that
                // was just reviewed and sent back).
                $table->unsignedInteger('round');
                // Who returned it: Dept Approval marking a submission
                // Wrong, or QA Verification marking Corrective Action
                // Implemented? No.
                $table->enum('stage', ['approval', 'qa']);
                $table->string('returned_by')->nullable();
                $table->dateTime('returned_at')->nullable();
                $table->longText('remarks')->nullable();
                $table->timestamps();

                $table->index('qdn_id');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('qdn_capa_returns');

        if (Schema::hasColumn('qdn_capa_corrections', 'round')) {
            Schema::table('qdn_capa_corrections', fn (Blueprint $table) => $table->dropColumn('round'));
        }
        if (Schema::hasColumn('qdn_capa_containment_lots', 'round')) {
            Schema::table('qdn_capa_containment_lots', fn (Blueprint $table) => $table->dropColumn('round'));
        }

        Schema::table('qdns', function (Blueprint $table) {
            $drop = array_values(array_filter([
                Schema::hasColumn('qdns', 'capa_round') ? 'capa_round' : null,
                Schema::hasColumn('qdns', 'capa_approval_status') ? 'capa_approval_status' : null,
                Schema::hasColumn('qdns', 'qa_capa_implemented') ? 'qa_capa_implemented' : null,
            ]));
            if ($drop) {
                $table->dropColumn($drop);
            }
        });
    }
};
