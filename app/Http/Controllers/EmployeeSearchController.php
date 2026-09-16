<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Server-side, type-ahead employee search -- backs every "select an
 * employee" picker across the QDN feature (RCA Select Responsible /
 * Issued To, PE Validate's Issued To, CAPA Inspected By / Operator /
 * Supervisor / Corrective Action Responsible). Replaces the old pattern
 * of preloading a whole department's (or the whole company's)
 * employee_masterlist roster into page props on every load -- results
 * are only ever fetched a page at a time (max 20), as the user types
 * either an EMPLOYID or part of an EMPLOYNAME.
 *
 * Narrowing params (all optional, combinable):
 *   - department: exact match against DEPARTMENT (RCA/CAPA "Responsible"
 *     / "Issued To", scoped to the QDN's issued_department)
 *   - titles[]: exact JOB_TITLE match, OR'd together (CAPA Inspected By)
 *   - like[]: JOB_TITLE LIKE patterns, OR'd together (CAPA
 *     Operator/Supervisor, e.g. '%Supervisor%')
 * With none of those, searches the whole employee_masterlist (PE
 * Validate's Issued To, and RCA's "Issued To (Man)" picker -- neither was
 * spec'd with a department restriction).
 */
class EmployeeSearchController extends Controller
{
    private const MAX_RESULTS = 20;

    public function search(Request $request): JsonResponse
    {
        $data = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'department' => ['nullable', 'string'],
            'titles' => ['nullable', 'array'],
            'titles.*' => ['string'],
            'like' => ['nullable', 'array'],
            'like.*' => ['string'],
        ]);

        $query = Employee::query();

        if (!empty($data['department'])) {
            $query->where('DEPARTMENT', $data['department']);
        }

        if (!empty($data['titles']) || !empty($data['like'])) {
            $query->where(function ($q) use ($data) {
                if (!empty($data['titles'])) {
                    $q->orWhereIn(Employee::JOB_TITLE_COLUMN, $data['titles']);
                }
                foreach ($data['like'] ?? [] as $pattern) {
                    $q->orWhere(Employee::JOB_TITLE_COLUMN, 'like', $pattern);
                }
            });
        }

        // Type EMPLOYID or EMPLOYNAME (or part of either) -- per spec,
        // "search must be user friendly i can type the EMPNAME and
        // EMPLOYID".
        // Real column is EMPNAME, not EMPLOYNAME -- see the note on
        // Employee::getEMPLOYNAMEAttribute(). The JSON response below
        // still comes back with an EMPLOYNAME key (via $appends) so the
        // frontend doesn't need to change.
        $term = trim((string) ($data['q'] ?? ''));
        if ($term !== '') {
            $query->where(function ($q) use ($term) {
                $q->where('EMPLOYID', 'like', "%{$term}%")
                    ->orWhere('EMPNAME', 'like', "%{$term}%");
            });
        }

        $employees = $query->orderBy('EMPNAME')
            ->limit(self::MAX_RESULTS)
            ->get(['EMPLOYID', 'EMPNAME', 'DEPARTMENT', 'STATION', 'PRODLINE', 'TEAM']);

        return response()->json(['employees' => $employees]);
    }
}
