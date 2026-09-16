<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('qdn_rca_causes', function (Blueprint $table) {
            $table->unsignedBigInteger('defect_source_id')->nullable()->after('defect_name');
            $table->string('defect_source_name')->nullable()->after('defect_source_id');
            $table->json('issued_to')->nullable()->after('defect_source_name');
        });
    }

    public function down(): void
    {
        Schema::table('qdn_rca_causes', function (Blueprint $table) {
            $table->dropColumn(['defect_source_id', 'defect_source_name', 'issued_to']);
        });
    }
};
