<?php

namespace Database\Seeders;

use App\Models\Qdn;
use App\Services\QdnNumberGenerator;
use Illuminate\Database\Seeder;

/**
 * Seeds a couple of demo QDNs on the app's OWN table (qdns, default
 * connection) so the PE queue isn't empty during development.
 *
 * This does NOT seed qdn_db (customer_list/package_list/machine_list/
 * location_list/nonconformity_list) or employee.masterlist -- those live
 * on separate live databases (connections: tspi_qa / masterlist) that
 * this app only reads from.
 *
 * Run with: php artisan db:seed --class=QdnDemoSeeder
 * (adjust the *_id / *_name values below to match real rows that exist
 * in your qdn_db lookup tables).
 */
class QdnDemoSeeder extends Seeder
{
    public function run(): void
    {
        Qdn::create([
            'qdn_no' => QdnNumberGenerator::next(),
            'customer_id' => 1,
            'customer_name' => 'Sample Customer A',
            'lot_id' => 'LOT-0001',
            'lot_qty' => 500,
            'device_name' => 'DEV-1234',
            'package_name' => 'QFN-32',
            'machine_id' => 1,
            'machine_num' => 'M-001',
            'location_id' => 1,
            'detection_area' => 'Final Visual Inspection',
            'detected_at' => now()->subDay(),
            'nonconformity_id' => 1,
            'nonconformity_name' => 'Scratch on package surface',
            'nonconformity_category' => 1,
            'classification' => 'Minor',
            'details' => '<p>Sample seeded QDN for local development.</p>',
            'status' => Qdn::STATUS_PENDING_PE,
            'issued_by' => 'Demo Issuer',
        ]);
    }
}
