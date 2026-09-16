<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Denormalized copy of the "Issued To" employee's DEPARTMENT (set at
     * PE validation time, see PeValidationController@store), so the
     * department a QDN was routed to can filter its own queue with a
     * simple WHERE instead of joining qdn_validations every time.
     * Runs on the default connection, same as the qdns table itself.
     */
    public function up(): void
    {
        Schema::table('qdns', function (Blueprint $table) {
            $table->string('issued_department')->nullable()->after('status')->index();
        });
    }

    public function down(): void
    {
        Schema::table('qdns', function (Blueprint $table) {
            $table->dropColumn('issued_department');
        });
    }
};
