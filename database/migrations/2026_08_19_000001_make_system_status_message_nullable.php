<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * system_status.message was created NOT NULL with no default, so any
     * insert that omits it (e.g. SystemStatus::create(['status' => 'online']))
     * fails with "Column 'message' cannot be null". This makes it nullable
     * with a sensible default instead, so status pings without an explicit
     * message stop crashing.
     *
     * Uses a raw ALTER TABLE rather than Blueprint::change() so it doesn't
     * depend on doctrine/dbal being installed.
     */
    public function up(): void
    {
        DB::statement("ALTER TABLE `system_status` MODIFY `message` LONGTEXT NULL DEFAULT NULL");
    }

    public function down(): void
    {
        // Reverting to NOT NULL would fail if any row currently has a NULL
        // message -- backfill first if you ever need to roll this back.
        DB::statement("ALTER TABLE `system_status` MODIFY `message` LONGTEXT NOT NULL");
    }
};
