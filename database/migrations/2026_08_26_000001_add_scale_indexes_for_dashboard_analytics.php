<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Indexes the Dashboard's aggregate rollups (5-Block Model, 10-Question
     * Checklist, Pareto, Compliance) and the new Corrective Action
     * Tracker / Effectiveness Verification pages depend on to stay fast
     * once qdns has 100k+ rows. Everything here is a COUNT/AVG/WHERE
     * EXISTS pattern -- fine on any table size as long as the columns
     * being filtered, joined, or grouped on are indexed; without these,
     * the same queries degrade to full table scans as the table grows.
     *
     * qdns.status, .detected_at, and .issued_department are already
     * indexed (see 2026_08_18_000001 / _000003); qdn_rca_causes,
     * qdn_capa_containment_lots, qdn_capa_corrections, and
     * qdn_capa_returns already index qdn_id (their FK columns get an
     * index automatically, plus qdn_rca_causes has an explicit composite
     * on [qdn_id, cause_type]). This migration only adds what's actually
     * missing.
     *
     * Uses information_schema.statistics to check for an existing index
     * by name before adding it, rather than Schema::hasColumn-style
     * guards -- Laravel has no built-in "hasIndex" helper, and this
     * keeps the migration safe to run against a database where some of
     * these might already exist from manual DBA work.
     */
    public function up(): void
    {
        $this->addIndexIfMissing('qdns', 'qdns_created_at_index', function (Blueprint $table) {
            $table->index('created_at');
        });

        // Dashboard/Records both filter on these; qdns can have 100k+ rows
        // with a small number of distinct customers/nonconformities/areas,
        // so these are exactly the low-cardinality-filter, high-row-count
        // indexes that matter most as the table grows.
        $this->addIndexIfMissing('qdns', 'qdns_customer_id_index', function (Blueprint $table) {
            $table->index('customer_id');
        });
        $this->addIndexIfMissing('qdns', 'qdns_nonconformity_id_index', function (Blueprint $table) {
            $table->index('nonconformity_id');
        });
        $this->addIndexIfMissing('qdns', 'qdns_detection_area_index', function (Blueprint $table) {
            $table->index('detection_area');
        });

        // Effectiveness Verification's "Result Met?" filter and the
        // Compliance/5-Block/10-Question rollups' AVG(CASE WHEN
        // qa_capa_implemented ...) all filter/group on this column.
        $this->addIndexIfMissing('qdns', 'qdns_qa_capa_implemented_index', function (Blueprint $table) {
            $table->index('qa_capa_implemented');
        });

        // Composite -- Records' and the Dashboard's most common query
        // shape is "filter by status, order by created_at," which a
        // composite index serves directly instead of two separate
        // single-column indexes forcing a sort after the fact.
        $this->addIndexIfMissing('qdns', 'qdns_status_created_at_index', function (Blueprint $table) {
            $table->index(['status', 'created_at']);
        });

        // Corrective Action Tracker's UNION query joins containment/
        // correction rows back to qdns and filters to the current round
        // (l.round = q.capa_round) -- a composite on [qdn_id, round]
        // serves that directly instead of an index-then-filter.
        $this->addIndexIfMissing('qdn_capa_containment_lots', 'qdn_capa_containment_lots_qdn_id_round_index', function (Blueprint $table) {
            $table->index(['qdn_id', 'round']);
        });
        $this->addIndexIfMissing('qdn_capa_corrections', 'qdn_capa_corrections_qdn_id_round_index', function (Blueprint $table) {
            $table->index(['qdn_id', 'round']);
        });
    }

    public function down(): void
    {
        $this->dropIndexIfExists('qdns', 'qdns_created_at_index');
        $this->dropIndexIfExists('qdns', 'qdns_customer_id_index');
        $this->dropIndexIfExists('qdns', 'qdns_nonconformity_id_index');
        $this->dropIndexIfExists('qdns', 'qdns_detection_area_index');
        $this->dropIndexIfExists('qdns', 'qdns_qa_capa_implemented_index');
        $this->dropIndexIfExists('qdns', 'qdns_status_created_at_index');
        $this->dropIndexIfExists('qdn_capa_containment_lots', 'qdn_capa_containment_lots_qdn_id_round_index');
        $this->dropIndexIfExists('qdn_capa_corrections', 'qdn_capa_corrections_qdn_id_round_index');
    }

    private function indexExists(string $table, string $indexName): bool
    {
        $database = DB::getDatabaseName();

        return DB::table('information_schema.statistics')
            ->where('table_schema', $database)
            ->where('table_name', $table)
            ->where('index_name', $indexName)
            ->exists();
    }

    private function addIndexIfMissing(string $table, string $indexName, \Closure $callback): void
    {
        if (Schema::hasTable($table) && !$this->indexExists($table, $indexName)) {
            Schema::table($table, $callback);
        }
    }

    private function dropIndexIfExists(string $table, string $indexName): void
    {
        if (Schema::hasTable($table) && $this->indexExists($table, $indexName)) {
            Schema::table($table, function (Blueprint $blueprint) use ($indexName) {
                $blueprint->dropIndex($indexName);
            });
        }
    }
};
