<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Lives on your app's DEFAULT connection, which now points at
     * qdn_new_db (via DB_DATABASE in .env) -- not qdn_db, since you
     * didn't want the app to depend on/own that schema. The lookup
     * tables (customer_list/package_list/machine_list/location_list/
     * nonconformity_list) are copied into qdn_new_db too, one-time, via
     * app/Console/Commands/CopyQdnLookupTables.php.
     *
     * No explicit $connection property -- it deliberately uses whatever
     * the default connection is, same as your users/sessions/etc. tables.
     *
     * Still no hard FK constraints to the lookup tables: their real
     * PK column names/types weren't confirmed (see README's assumptions
     * table), so this stores the source id plus a denormalized snapshot
     * of the label -- safe to tighten into real foreign keys later once
     * you confirm those tables' actual primary keys.
     */
    public function up(): void
    {
        Schema::create('qdns', function (Blueprint $table) {
            $table->id();

            // yyyy-xxxxxxx, e.g. 2026-0000001
            $table->string('qdn_no', 20)->unique();

            // Customer (qdn_db.customer_list)
            $table->unsignedBigInteger('customer_id');
            $table->string('customer_name')->nullable();

            $table->string('lot_id');
            $table->unsignedInteger('lot_qty');

            $table->string('device_name');

            // Auto-filled from qdn_db.package_list (devicename -> package_type)
            $table->string('package_name')->nullable();

            // Machine (qdn_db.machine_list)
            $table->unsignedBigInteger('machine_id');
            $table->string('machine_num')->nullable();

            // Detection Area (qdn_db.location_list -> location_name)
            $table->unsignedBigInteger('location_id');
            $table->string('detection_area')->nullable();

            $table->dateTime('detected_at');

            // Type of Non-Conformity / Failure Mode (qdn_db.nonconformity_list)
            $table->unsignedBigInteger('nonconformity_id');
            $table->string('nonconformity_name')->nullable();

            // Snapshot of qdn_db.nonconformity_list.nonconformity_category (1/2/3)
            $table->unsignedTinyInteger('nonconformity_category')->nullable();

            // Derived from nonconformity_category: Minor | Major | Critical
            $table->enum('classification', ['Minor', 'Major', 'Critical'])->nullable();

            // Rich-text (HTML) details written by the issuer
            $table->longText('details');

            // Workflow status
            $table->enum('status', [
                'pending_pe',     // submitted, waiting for PE validation
                'issued',         // PE marked valid, routed to "Issued To" person/department
                'invalid',        // PE marked invalid
            ])->default('pending_pe');

            // Who raised it (free text for now since SSO/auth isn't wired up yet)
            $table->string('issued_by')->nullable();

            $table->timestamps();

            $table->index('status');
            $table->index('detected_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('qdns');
    }
};
