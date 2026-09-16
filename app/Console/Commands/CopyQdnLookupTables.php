<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * One-time copy of the QDN lookup tables from your existing qdn_db
 * database (connection key: tspi_qa) into your app's DEFAULT
 * connection, which is 'mysql' in your config/database.php and now
 * points at qdn_new_db (via DB_DATABASE). After this runs,
 * app/Models/Customer.php, Package.php, Machine.php, Location.php, and
 * Nonconformity.php all read from qdn_new_db -- qdn_db (tspi_qa) is only
 * ever touched by this command, as the source.
 *
 * Table structure is cloned exactly via `SHOW CREATE TABLE` rather than
 * guessed, so this doesn't depend on knowing each table's real column
 * types up front.
 *
 * This is a one-time / on-demand copy, not a sync job -- nothing runs
 * this automatically. Re-run it manually whenever you want to refresh
 * qdn_new_db's copies from qdn_db.
 *
 * NOTE: defect_list was removed from this list -- it doesn't exist in
 * qdn_db ("still dont have defect_list table"). "Source of Defect" is now
 * an app-owned static table (defect_source) seeded directly by a
 * migration, not copied from anywhere -- see App\Models\Defect and
 * database/migrations/2026_08_24_000001_create_defect_source_table.php.
 *
 * Usage:
 *   php artisan qdn:copy-lookup-tables            # create-if-missing, then refresh data
 *   php artisan qdn:copy-lookup-tables --fresh     # drop + recreate structure from source first
 *   php artisan qdn:copy-lookup-tables --tables=customer_list,machine_list
 */
class CopyQdnLookupTables extends Command
{
    protected $signature = 'qdn:copy-lookup-tables
        {--fresh : Drop and recreate each destination table from the source DDL before copying}
        {--tables= : Comma-separated subset of tables to copy (default: all six)}
        {--chunk=500 : Row batch size for copying}';

    protected $description = 'One-time copy of qdn_db lookup tables (customer_list, package_list, machine_list, location_list, nonconformity_list, reason_root_cause) into your app\'s default database (qdn_new_db)';

    private const SOURCE_CONNECTION = 'tspi_qa';

    // null = the app's default connection (config('database.default')),
    // which now resolves to qdn_new_db via DB_DATABASE in .env.
    private const DEST_CONNECTION = null;

    private const TABLES = [
        'customer_list',
        'package_list',
        'machine_list',
        'location_list',
        'nonconformity_list',
        // Added for the structured RCA form's "Select Cause" -- see
        // App\Models\ReasonRootCause. "Source of Defect" used to be here
        // too (defect_list) but that source table doesn't exist -- see
        // App\Models\Defect instead.
        'reason_root_cause',
    ];

    public function handle(): int
    {
        $tables = $this->option('tables')
            ? array_map('trim', explode(',', $this->option('tables')))
            : self::TABLES;

        $fresh = (bool) $this->option('fresh');
        $chunkSize = max(1, (int) $this->option('chunk'));

        $summary = [];

        foreach ($tables as $table) {
            try {
                $summary[] = $this->copyTable($table, $fresh, $chunkSize);
            } catch (\Throwable $e) {
                $this->error("  ✗ {$table}: {$e->getMessage()}");
                $summary[] = [$table, 'FAILED', $e->getMessage()];
            }
        }

        $this->newLine();
        $this->table(['Table', 'Rows Copied', 'Notes'], $summary);

        return self::SUCCESS;
    }

    private function copyTable(string $table, bool $fresh, int $chunkSize): array
    {
        $source = DB::connection(self::SOURCE_CONNECTION);
        $dest = DB::connection(self::DEST_CONNECTION);
        $destSchema = Schema::connection(self::DEST_CONNECTION);

        if (!$source->getSchemaBuilder()->hasTable($table)) {
            throw new \RuntimeException("source table not found in qdn_db ({$table})");
        }

        if ($fresh) {
            $destSchema->dropIfExists($table);
        }

        $tableExisted = $destSchema->hasTable($table);

        if (!$tableExisted) {
            $this->info("Creating {$table} in the default database (qdn_new_db) from source DDL...");
            $ddl = $this->sourceCreateTableSql($source, $table);
            $dest->statement($ddl);
        } else {
            // Table already exists -- refresh its data only.
            $dest->table($table)->truncate();
        }

        $this->info("Copying {$table}...");
        $rowCount = 0;

        $source->table($table)->orderBy(DB::raw('1'))->chunk($chunkSize, function ($rows) use ($dest, $table, &$rowCount) {
            $batch = $rows->map(fn ($row) => (array) $row)->all();

            if (!empty($batch)) {
                $dest->table($table)->insert($batch);
                $rowCount += count($batch);
            }
        });

        $this->info("  ✓ {$table}: {$rowCount} row(s)");

        $note = match (true) {
            $fresh => 'recreated + copied',
            !$tableExisted => 'created + copied',
            default => 'truncated + copied',
        };

        return [$table, $rowCount, $note];
    }

    /**
     * Reads the exact CREATE TABLE statement from the source connection
     * so the destination table matches column types/nullability exactly,
     * rather than guessing them in a migration.
     */
    private function sourceCreateTableSql($sourceConnection, string $table): string
    {
        $row = $sourceConnection->selectOne("SHOW CREATE TABLE `{$table}`");
        $row = (array) $row;

        // MySQL returns the DDL under a 'Create Table' key.
        $ddl = $row['Create Table'] ?? reset($row);

        // Don't fail if this command is re-run without --fresh right
        // after the table already exists.
        return preg_replace('/^CREATE TABLE/', 'CREATE TABLE IF NOT EXISTS', $ddl, 1);
    }
}
