<?php

namespace App\Http\Controllers;

use App\Models\Qdn;
use App\Support\CurrentEmployee;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Once PE marks a QDN valid, it's routed to the "Issued To" employee's
 * department and enters the RCA -> CAPA -> Approval -> QA Verification
 * workflow (see QdnWorkflowController). This mirrors PeValidationController's
 * PE queue: anyone in that department (per employee.masterlist DEPARTMENT)
 * can see every QDN issued to it, not just the specific person it was
 * assigned to -- and not just while it's sitting in one particular stage.
 * Qdn::DEPARTMENT_VISIBLE_STATUSES covers the whole lifecycle from "issued"
 * through "closed", so this page acts as the department's overall QDN
 * status board, while QdnWorkflowController's per-stage pages are where
 * they actually act on whichever ones are currently theirs to move.
 */
class IssuedQdnController extends Controller
{
    public function index(): Response
    {
        $department = CurrentEmployee::department();

        return Inertia::render('Qdn/IssuedIndex', [
            'department' => $department,
            'qdns' => $department
                ? Qdn::whereIn('status', Qdn::DEPARTMENT_VISIBLE_STATUSES)
                    ->where('issued_department', $department)
                    ->orderByDesc('created_at')
                    ->get(['id', 'qdn_no', 'customer_name', 'device_name', 'classification', 'status', 'created_at'])
                    ->map(fn (Qdn $qdn) => [
                        'id' => $qdn->id,
                        'qdn_no' => $qdn->qdn_no,
                        'customer_name' => $qdn->customer_name,
                        'device_name' => $qdn->device_name,
                        'classification' => $qdn->classification,
                        'status_label' => $qdn->statusLabel(),
                        'created_at' => $qdn->created_at,
                    ])
                : collect(),
        ]);
    }

    public function show(Qdn $qdn): Response
    {
        abort_unless(
            $qdn->issued_department === CurrentEmployee::department(),
            403,
            'This QDN was not issued to your department.'
        );

        return Inertia::render('Qdn/IssuedShow', [
            'qdn' => array_merge(
                $qdn->load(['validation', 'rcaCauses', 'capaContainmentLots', 'capaCorrections'])->toArray(),
                ['status_label' => $qdn->statusLabel()]
            ),
        ]);
    }
}
