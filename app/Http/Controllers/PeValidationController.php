<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreQdnValidationRequest;
use App\Models\Employee;
use App\Models\Qdn;
use App\Models\QdnValidation;
use App\Support\CurrentEmployee;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

class PeValidationController extends Controller
{
    /**
     * Only employees whose employee.masterlist DEPARTMENT is "PE" can
     * see or act on the validation queue -- this is what makes it
     * visible to "all PE", not just whoever happens to hit the route.
     */
    private function assertIsPe(): void
    {
        if (!CurrentEmployee::isPe()) {
            throw new HttpException(403, 'Only Department: PE can access QDN validation.');
        }
    }

    /**
     * PE's queue: QDNs waiting for validation. Visible to anyone in
     * DEPARTMENT: PE (not tied to who originally... there's no
     * "assignee", any PE employee can pick any pending QDN up).
     */
    public function index(): Response
    {
        $this->assertIsPe();

        return Inertia::render('Qdn/Index', [
            'qdns' => Qdn::where('status', Qdn::STATUS_PENDING_PE)
                ->orderBy('created_at')
                ->get(['id', 'qdn_no', 'customer_name', 'device_name', 'classification', 'created_at']),
        ]);
    }

    /**
     * Step 2: Validate a single QDN.
     */
    public function show(Qdn $qdn): Response
    {
        $this->assertIsPe();

        return Inertia::render('Qdn/Validate', [
            'qdn' => $qdn,
            // "Issued To" is a server-side type-ahead (EmployeeSearchSelect
            // -> GET /employees/search, unscoped -- any employee company-
            // wide) instead of preloading the entire employee_masterlist
            // into every page load. employeeLookup() below is unused by
            // this page now, left in place in case anything else calls it.
        ]);
    }

    /**
     * AJAX lookup used by the Validate form: given an EMPLOYID, resolve
     * DEPARTMENT / STATION / PRODLINE / TEAM from employee.masterlist.
     */
    public function employeeLookup(Request $request): JsonResponse
    {
        $this->assertIsPe();

        $request->validate(['employ_id' => ['required', 'string']]);

        $employee = Employee::find($request->string('employ_id'));

        return response()->json([
            'department' => $employee?->DEPARTMENT,
            'station' => $employee?->STATION,
            'prodline' => $employee?->PRODLINE,
            'team' => $employee?->TEAM,
        ]);
    }

    /**
     * Record the PE decision. If valid, route the QDN to the selected
     * employee's department -- from this point on, everyone in that
     * department (per employee.masterlist DEPARTMENT) can see it via
     * IssuedQdnController@index, the same way all of PE can see the
     * pending queue above. If invalid, close it out.
     */
    public function store(StoreQdnValidationRequest $request, Qdn $qdn): RedirectResponse
    {
        $this->assertIsPe();

        $data = $request->validated();

        $employee = null;
        if (!empty($data['issued_to_employee_id'])) {
            $employee = Employee::find($data['issued_to_employee_id']);
        }

        QdnValidation::create([
            'qdn_id' => $qdn->id,
            'is_valid' => $data['is_valid'],
            'issued_to_employee_id' => $employee?->EMPLOYID,
            'issued_to_name' => $employee?->EMPLOYNAME,
            'department' => $employee?->DEPARTMENT,
            'station' => $employee?->STATION,
            'prodline' => $employee?->PRODLINE,
            'team' => $employee?->TEAM,
            // Server-derived from session('emp_data'), not client input.
            'validated_by' => CurrentEmployee::name(),
            'validated_at' => now(),
            'remarks' => $data['remarks'] ?? null,
        ]);

        $qdn->update([
            // Valid QDNs now enter the full disposition workflow (RCA -> PE
            // validates RCA -> CAPA -> Dept approval -> QA verification)
            // instead of stopping at a plain "issued" status -- see
            // QdnWorkflowController for every step after this one.
            'status' => $data['is_valid'] ? Qdn::STATUS_FOR_DEPT_RCA : Qdn::STATUS_INVALID,
            // Denormalized so the receiving department's queue can filter
            // with a plain WHERE -- see IssuedQdnController@index and
            // QdnWorkflowController's assertOwningDepartment().
            'issued_department' => $data['is_valid'] ? $employee?->DEPARTMENT : null,
        ]);

        return redirect()
            ->route('pe.qdn.index')
            ->with('success', $data['is_valid']
                ? "QDN {$qdn->qdn_no} marked valid and routed to {$employee?->DEPARTMENT} for RCA."
                : "QDN {$qdn->qdn_no} marked invalid.");
    }
}
