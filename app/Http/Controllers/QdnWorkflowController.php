<?php

namespace App\Http\Controllers;

use App\Models\Defect;
use App\Models\Employee;
use App\Models\Machine;
use App\Models\Qdn;
use App\Models\QdnCapaContainmentLot;
use App\Models\QdnCapaCorrection;
use App\Models\QdnCapaReturn;
use App\Models\QdnRcaCause;
use App\Models\ReasonRootCause;
use App\Support\CurrentEmployee;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * The disposition workflow that runs after PE's initial valid/invalid
 * call (PeValidationController@store):
 *
 *   for_dept_rca -> for_pe_rca_validation -> for_dept_capa
 *   -> for_dept_approval -> for_qa_verification -> closed
 *
 * Every "reject" step sends the QDN back one department-owned stage for
 * rework rather than all the way back to the start.
 *
 * Visibility, same shared-queue pattern as everywhere else in this app:
 *   - RCA / CAPA / Dept Approval: anyone whose session emp_data.emp_dept
 *     matches the QDN's issued_department (the department PE originally
 *     routed it to).
 *   - PE Validation of RCA: anyone in Department: PE.
 *   - QA Verification: anyone in Department: QA.
 */
class QdnWorkflowController extends Controller
{
    private const SUMMARY_COLUMNS = [
        'id', 'qdn_no', 'customer_name', 'device_name', 'classification',
        'status', 'issued_department', 'created_at',
    ];

    private function assertOwningDepartment(Qdn $qdn): void
    {
        if (!$qdn->issued_department || !CurrentEmployee::isInDepartment((string) $qdn->issued_department)) {
            throw new HttpException(403, 'This QDN was not issued to your department.');
        }
    }

    private function assertIsPe(): void
    {
        if (!CurrentEmployee::isPe()) {
            throw new HttpException(403, 'Only Department: PE can access this step.');
        }
    }

    private function assertIsQa(): void
    {
        if (!CurrentEmployee::isQa()) {
            throw new HttpException(403, 'Only Department: QA can access QA Verification.');
        }
    }

    /**
     * "RCA and CAPA can only answer by Supervisor, Section, and Manager"
     * -- everyone in the owning department can still see/open the RCA and
     * CAPA forms (assertOwningDepartment() alone gates that), but only
     * Supervisor-and-up can actually submit one. Checked in rcaStore() /
     * capaStore() only, not rcaShow()/capaShow(), same "visible to all,
     * action restricted" pattern chosen for Dept Approval below.
     */
    private function assertCanAnswerRcaOrCapa(): void
    {
        if (!CurrentEmployee::isSupervisorAndUp()) {
            throw new HttpException(403, 'Only Supervisor, Section Head, or Manager can submit this.');
        }
    }

    /**
     * "Approver should be Section Head and Manager" -- narrower than
     * assertCanAnswerRcaOrCapa() above (excludes plain Supervisor).
     * Everyone in the owning department can still see the "For Approval"
     * queue and open a QDN's approval page; only this checks the actual
     * Correct/Wrong decision in approvalStore().
     */
    private function assertIsApprover(): void
    {
        if (!CurrentEmployee::isApprover()) {
            throw new HttpException(403, 'Only Section Head or Manager can approve CAPA.');
        }
    }

    // -- Dept RCA -----------------------------------------------------

    public function rcaIndex(): Response
    {
        $department = CurrentEmployee::department();

        return Inertia::render('Qdn/Rca/Index', [
            'department' => $department,
            'qdns' => $department
                ? Qdn::where('status', Qdn::STATUS_FOR_DEPT_RCA)
                    ->where('issued_department', $department)
                    ->orderBy('created_at')
                    ->get(self::SUMMARY_COLUMNS)
                : collect(),
        ]);
    }

    public function rcaShow(Qdn $qdn): Response
    {
        $this->assertOwningDepartment($qdn);
        abort_unless($qdn->status === Qdn::STATUS_FOR_DEPT_RCA, 409, 'This QDN is not currently awaiting RCA.');

        // 'validation' -- without it, QdnDetailCard's "PE Validation"
        // section (which is where "Issued To" is shown) silently didn't
        // render on this page at all. Same eager-load gap already found
        // and fixed on peRcaShow/approvalShow/qaShow.
        $qdn->load(['rcaCauses', 'validation']);
        $groups = $qdn->rcaCauses->groupBy('cause_type');

        return Inertia::render('Qdn/Rca/Show', [
            'qdn' => $qdn,
            // Whole department can open/fill this form, but only
            // Supervisor-and-up can submit it -- see
            // assertCanAnswerRcaOrCapa(). The page uses this to disable
            // the Submit button and show a notice rather than let someone
            // fill the whole thing out and hit a 403 at the end.
            'canSubmit' => CurrentEmployee::isSupervisorAndUp(),
            // Existing rows, grouped so the form can pre-fill each of the
            // three repeatable sections (e.g. when PE rejected the RCA and
            // sent it back for rework).
            'event' => $this->causeRows($groups->get(QdnRcaCause::TYPE_EVENT)),
            'escape' => $this->causeRows($groups->get(QdnRcaCause::TYPE_ESCAPE)),
            'system' => $this->causeRows($groups->get(QdnRcaCause::TYPE_SYSTEM)),
            // Select Cause (qdn_db.reason_root_cause)
            'reasonRootCauses' => ReasonRootCause::orderBy(ReasonRootCause::LABEL_COLUMN)
                ->get(['id', ReasonRootCause::LABEL_COLUMN])
                ->map(fn (ReasonRootCause $r) => ['id' => $r->id, 'label' => $r->label()])
                ->values(),
            // Source of Defect (qdn_db.defect_list)
            'defects' => Defect::orderBy(Defect::LABEL_COLUMN)
                ->get(['id', Defect::LABEL_COLUMN])
                ->map(fn (Defect $d) => ['id' => $d->id, 'label' => $d->label()])
                ->values(),
            // Select Responsible / Issued To no longer preload the whole
            // department roster -- both fields are now a server-side
            // type-ahead (EmployeeSearchSelect -> GET /employees/search,
            // scoped to this QDN's issued_department). See
            // App\Http\Controllers\EmployeeSearchController.
        ]);
    }

    private function causeRows($rows): array
    {
        return collect($rows ?? [])
            ->map(fn (QdnRcaCause $r) => [
                'reason_root_cause_id' => $r->reason_root_cause_id,
                'cause' => $r->cause,
                'defect_source_id' => $r->defect_source_id,
                'responsible_employee_id' => $r->responsible_employee_id,
                // Name is stored alongside the id already (denormalized,
                // same as everything else on this row) -- sent along so
                // the EmployeeSearchSelect can render the existing
                // selection without a lookup round-trip when this RCA was
                // previously submitted and sent back for rework.
                'responsible_employee_name' => $r->responsible_employee_name,
                // "Issued To" list -- a JSON column on this row (cast to
                // array by QdnRcaCause), only ever populated when this
                // row's Source of Defect is "Man".
                'issued_to' => $r->issued_to ?? [],
            ])
            ->values()
            ->all();
    }

    public function rcaStore(Request $request, Qdn $qdn): RedirectResponse
    {
        $this->assertOwningDepartment($qdn);
        $this->assertCanAnswerRcaOrCapa();
        abort_unless($qdn->status === Qdn::STATUS_FOR_DEPT_RCA, 409, 'This QDN is not currently awaiting RCA.');

        $rowRules = [
            'reason_root_cause_id' => ['nullable'],
            'cause' => ['nullable', 'string'],
            'defect_source_id' => ['nullable'],
            'responsible_employee_id' => ['nullable', 'string'],
            // "Issued To" -- only meaningful when defect_source_id
            // resolves to "Man" (enforced client-side by only showing the
            // picker then), but validated loosely here too: each entry
            // just needs an employee_id, everything else is looked up/
            // snapshotted server-side in syncRcaCauses() (client-supplied
            // name/department/etc. are never trusted/stored directly).
            'issued_to' => ['nullable', 'array'],
            'issued_to.*.employee_id' => ['nullable', 'string'],
        ];

        $data = $request->validate([
            'event' => ['array'],
            'event.*.reason_root_cause_id' => $rowRules['reason_root_cause_id'],
            'event.*.cause' => $rowRules['cause'],
            'event.*.defect_source_id' => $rowRules['defect_source_id'],
            'event.*.responsible_employee_id' => $rowRules['responsible_employee_id'],
            'event.*.issued_to' => $rowRules['issued_to'],
            'event.*.issued_to.*.employee_id' => $rowRules['issued_to.*.employee_id'],
            'escape' => ['array'],
            'escape.*.reason_root_cause_id' => $rowRules['reason_root_cause_id'],
            'escape.*.cause' => $rowRules['cause'],
            'escape.*.defect_source_id' => $rowRules['defect_source_id'],
            'escape.*.responsible_employee_id' => $rowRules['responsible_employee_id'],
            'escape.*.issued_to' => $rowRules['issued_to'],
            'escape.*.issued_to.*.employee_id' => $rowRules['issued_to.*.employee_id'],
            'system' => ['array'],
            'system.*.reason_root_cause_id' => $rowRules['reason_root_cause_id'],
            'system.*.cause' => $rowRules['cause'],
            'system.*.defect_source_id' => $rowRules['defect_source_id'],
            'system.*.responsible_employee_id' => $rowRules['responsible_employee_id'],
            'system.*.issued_to' => $rowRules['issued_to'],
            'system.*.issued_to.*.employee_id' => $rowRules['issued_to.*.employee_id'],
        ]);

        DB::transaction(function () use ($qdn, $data) {
            $this->syncRcaCauses($qdn, QdnRcaCause::TYPE_EVENT, $data['event'] ?? []);
            $this->syncRcaCauses($qdn, QdnRcaCause::TYPE_ESCAPE, $data['escape'] ?? []);
            $this->syncRcaCauses($qdn, QdnRcaCause::TYPE_SYSTEM, $data['system'] ?? []);

            $qdn->update([
                'rca_submitted_by' => CurrentEmployee::name(),
                'rca_submitted_at' => now(),
                'status' => Qdn::STATUS_FOR_PE_RCA_VALIDATION,
            ]);
        });

        return redirect()
            ->route('qdn.rca.index')
            ->with('success', "RCA submitted for QDN {$qdn->qdn_no}, routed to Department: PE for validation.");
    }

    /**
     * Full replace of one cause_type's rows -- simpler and safer than
     * diffing against existing rows (which "+ add event" / removed rows
     * on the client would make error-prone), and this is only ever called
     * inside a DB::transaction().
     */
    private function syncRcaCauses(Qdn $qdn, string $type, array $rows): void
    {
        QdnRcaCause::where('qdn_id', $qdn->id)->where('cause_type', $type)->delete();

        $sortOrder = 0;
        foreach ($rows as $row) {
            // Skip fully-empty rows (e.g. a "+ add event" row the user
            // never filled in before submitting).
            if (empty($row['reason_root_cause_id']) && empty($row['cause'])
                && empty($row['defect_source_id']) && empty($row['responsible_employee_id'])) {
                continue;
            }

            $reason = !empty($row['reason_root_cause_id']) ? ReasonRootCause::find($row['reason_root_cause_id']) : null;
            $defectSource = !empty($row['defect_source_id']) ? Defect::find($row['defect_source_id']) : null;
            $employee = !empty($row['responsible_employee_id']) ? Employee::find($row['responsible_employee_id']) : null;

            // "Issued To" list -- only stored when Source of Defect is
            // "Man" ($defectSource->isMan()), even if the client somehow
            // sent issued_to rows for a non-Man defect (e.g. stale state
            // after switching the dropdown), so this can't be spoofed
            // past the rule the UI enforces. Client-supplied
            // name/department/station/prodline are never trusted --
            // every entry is re-resolved from employee.masterlist here,
            // same snapshot pattern as responsible_employee_name above.
            $issuedTo = [];
            if ($defectSource?->isMan()) {
                foreach ($row['issued_to'] ?? [] as $issuedRow) {
                    if (empty($issuedRow['employee_id'])) {
                        continue;
                    }

                    $issuedEmployee = Employee::find($issuedRow['employee_id']);
                    if (!$issuedEmployee) {
                        continue;
                    }

                    $issuedTo[] = [
                        'employee_id' => $issuedEmployee->EMPLOYID,
                        'employee_name' => $issuedEmployee->EMPLOYNAME,
                        'department' => $issuedEmployee->DEPARTMENT,
                        'station' => $issuedEmployee->STATION,
                        'prodline' => $issuedEmployee->PRODLINE,
                    ];
                }
            }

            QdnRcaCause::create([
                'qdn_id' => $qdn->id,
                'cause_type' => $type,
                'reason_root_cause_id' => $row['reason_root_cause_id'] ?? null,
                'reason_root_cause_name' => $reason?->label(),
                'cause' => $row['cause'] ?? null,
                'defect_source_id' => $row['defect_source_id'] ?? null,
                'defect_source_name' => $defectSource?->label(),
                'issued_to' => $issuedTo,
                'responsible_employee_id' => $row['responsible_employee_id'] ?? null,
                'responsible_employee_name' => $employee?->EMPLOYNAME,
                'sort_order' => $sortOrder++,
            ]);
        }
    }

    // -- PE Validation of RCA ------------------------------------------

    public function peRcaIndex(): Response
    {
        $this->assertIsPe();

        return Inertia::render('Qdn/PeRca/Index', [
            'qdns' => Qdn::where('status', Qdn::STATUS_FOR_PE_RCA_VALIDATION)
                ->orderBy('created_at')
                ->get(self::SUMMARY_COLUMNS),
        ]);
    }

    public function peRcaShow(Qdn $qdn): Response
    {
        $this->assertIsPe();
        abort_unless($qdn->status === Qdn::STATUS_FOR_PE_RCA_VALIDATION, 409, 'This QDN is not currently awaiting PE validation of its RCA.');

        // 'rcaCauses' / 'validation' -- without these, QdnDetailCard's
        // "Root Cause Analysis (RCA)" and "PE Validation" sections (which
        // the Disposition page's spec calls out by name: "Details of
        // Issuance / PE Validation / RCA / Disposition") had nothing to
        // render; this page never eager-loaded either before.
        $qdn->load(['rcaCauses', 'validation']);

        return Inertia::render('Qdn/PeRca/Show', ['qdn' => $qdn]);
    }

    /**
     * PE Disposition -- replaces the old generic approve/reject with the
     * six specific outcomes: Rework / Split Lot / Shutdown / Shipback /
     * Use As Is / Invalid. Every outcome except Invalid routes the QDN
     * back to its issued_department for CAPA; Invalid closes it instead
     * (STATUS_INVALID_DISPOSITION) -- still fully visible in QDN Records
     * and the department's history, just not continuing to CAPA.
     */
    public function peRcaStore(Request $request, Qdn $qdn): RedirectResponse
    {
        $this->assertIsPe();
        abort_unless($qdn->status === Qdn::STATUS_FOR_PE_RCA_VALIDATION, 409, 'This QDN is not currently awaiting PE validation of its RCA.');

        $data = $request->validate([
            'disposition' => ['required', 'in:' . implode(',', Qdn::DISPOSITIONS)],
            'remarks' => ['nullable', 'string'],
        ]);

        $isInvalid = $data['disposition'] === Qdn::DISPOSITION_INVALID;

        $qdn->update([
            // Still recorded as "PE reviewed this RCA" -- same fields the
            // old approve/reject path set, kept for the existing "PE
            // Validated By/At" line in QdnDetailCard's RCA section.
            'rca_validated_by' => CurrentEmployee::name(),
            'rca_validated_at' => now(),
            'pe_disposition' => $data['disposition'],
            'pe_disposition_remarks' => $data['remarks'] ?? null,
            'pe_disposition_by' => CurrentEmployee::name(),
            'pe_disposition_at' => now(),
            'status' => $isInvalid ? Qdn::STATUS_INVALID_DISPOSITION : Qdn::STATUS_FOR_DEPT_CAPA,
        ]);

        $message = $isInvalid
            ? "QDN {$qdn->qdn_no} closed -- PE Disposition: Invalid."
            : "QDN {$qdn->qdn_no} disposition recorded ({$qdn->peDispositionLabel()}), routed to {$qdn->issued_department} for CAPA.";

        return redirect()->route('pe.rca.index')->with('success', $message);
    }

    // -- Department CAPA ------------------------------------------------

    public function capaIndex(): Response
    {
        $department = CurrentEmployee::department();

        return Inertia::render('Qdn/Capa/Index', [
            'department' => $department,
            'qdns' => $department
                ? Qdn::where('status', Qdn::STATUS_FOR_DEPT_CAPA)
                    ->where('issued_department', $department)
                    ->orderBy('created_at')
                    ->get(self::SUMMARY_COLUMNS)
                : collect(),
        ]);
    }

    public function capaShow(Qdn $qdn): Response
    {
        $this->assertOwningDepartment($qdn);
        abort_unless($qdn->status === Qdn::STATUS_FOR_DEPT_CAPA, 409, 'This QDN is not currently awaiting CAPA.');

        // 'validation' / 'rcaCauses' -- same eager-load gap already found
        // and fixed elsewhere in this file: without them, QdnDetailCard's
        // "PE Validation" (where "Issued To" is shown) and "Root Cause
        // Analysis" sections silently didn't render on this page at all.
        $qdn->load(['validation', 'rcaCauses', 'capaContainmentLots', 'capaCorrections', 'capaReturns']);

        // Prefill from the most recently-submitted round's rows, not
        // necessarily qdn.capa_round -- capa_round is "the round about to
        // be submitted next," which has no rows yet the first time this
        // page is opened after a return (Dept Approval "Wrong" / QA
        // "No"). Falls back to capa_round itself on a first-ever visit
        // (no rows submitted at all yet).
        $latestRound = $qdn->capaContainmentLots->max('round')
            ?? $qdn->capaCorrections->max('round')
            ?? $qdn->capa_round;
        $latestContainment = $qdn->capaContainmentLots->where('round', $latestRound)->values();
        $latestCorrection = $qdn->capaCorrections->where('round', $latestRound)->values();

        // Most recent return, if any -- shown as a banner on the form so
        // whoever is updating CAPA can see why it came back without
        // digging through QdnDetailCard's full history section.
        $lastReturn = $qdn->capaReturns->last();

        return Inertia::render('Qdn/Capa/Show', [
            'qdn' => $qdn,
            // Same "visible to all, action restricted" pattern as
            // rcaShow() -- see assertCanAnswerRcaOrCapa().
            'canSubmit' => CurrentEmployee::isSupervisorAndUp(),
            'lastReturn' => $lastReturn ? [
                'stage' => $lastReturn->stage,
                'returned_by' => $lastReturn->returned_by,
                'returned_at' => optional($lastReturn->returned_at)->toIso8601String(),
                'remarks' => $lastReturn->remarks,
                'round' => $lastReturn->round,
            ] : null,
            'containmentChecked' => (bool) $qdn->capa_containment_checked,
            'containment' => $latestContainment->map(fn (QdnCapaContainmentLot $lot) => [
                'date_processed' => optional($lot->date_processed)->format('Y-m-d\TH:i'),
                'lot_id' => $lot->lot_id,
                'part_name' => $lot->part_name,
                'qty' => $lot->qty,
                'inspected_by_employee_id' => $lot->inspected_by_employee_id,
                // Name alongside the id (already stored, same
                // denormalization as everything else here) -- lets the
                // EmployeeSearchSelect render the existing pick without a
                // lookup round-trip.
                'inspected_by_name' => $lot->inspected_by_name,
                'status' => $lot->status,
                'remarks' => $lot->remarks,
                'result_of_inspection' => $lot->result_of_inspection,
            ])->values(),
            'correctionChecked' => (bool) $qdn->capa_correction_checked,
            'correction' => $latestCorrection->map(fn (QdnCapaCorrection $c) => [
                'activity' => $c->activity,
                'qty_in' => $c->qty_in,
                'qty_out' => $c->qty_out,
                'operator_employee_id' => $c->operator_employee_id,
                'operator_employee_name' => $c->operator_employee_name,
                'supervisor_employee_id' => $c->supervisor_employee_id,
                'supervisor_employee_name' => $c->supervisor_employee_name,
                'machine_id' => $c->machine_id,
                'work_date' => optional($c->work_date)->format('Y-m-d'),
                'remarks' => $c->remarks,
            ])->values(),
            'correctiveAction' => [
                'what' => $qdn->capa_corrective_what,
                'responsible_employee_id' => $qdn->capa_corrective_responsible_employee_id,
                'responsible_employee_name' => $qdn->capa_corrective_responsible_name,
                'when' => optional($qdn->capa_corrective_when)->format('Y-m-d'),
                'status' => $qdn->capa_corrective_status,
            ],
            // Inspected By / Select Operator/FVI/OQA / Select Supervisor /
            // Corrective Action "Responsible" no longer preload whole
            // rosters -- all four are now a server-side type-ahead
            // (EmployeeSearchSelect -> GET /employees/search, scoped by
            // job title or department as appropriate on each field). See
            // App\Http\Controllers\EmployeeSearchController.
            // Machine No (qdn_db.machine_list) -- small fixed lookup,
            // still preloaded as a plain dropdown.
            'machines' => Machine::orderBy('machine_num')->get(['id', 'machine_num']),
        ]);
    }

    public function capaStore(Request $request, Qdn $qdn): RedirectResponse
    {
        $this->assertOwningDepartment($qdn);
        $this->assertCanAnswerRcaOrCapa();
        abort_unless($qdn->status === Qdn::STATUS_FOR_DEPT_CAPA, 409, 'This QDN is not currently awaiting CAPA.');

        $data = $request->validate([
            'containment_checked' => ['boolean'],
            'containment' => ['array'],
            'containment.*.date_processed' => ['nullable', 'date'],
            'containment.*.lot_id' => ['nullable', 'string'],
            'containment.*.part_name' => ['nullable', 'string'],
            'containment.*.qty' => ['nullable', 'integer'],
            'containment.*.inspected_by_employee_id' => ['nullable', 'string'],
            'containment.*.status' => ['nullable', 'in:open,done'],
            'containment.*.remarks' => ['nullable', 'string'],
            'containment.*.result_of_inspection' => ['nullable', 'string'],

            'correction_checked' => ['boolean'],
            'correction' => ['array'],
            'correction.*.activity' => ['nullable', 'string'],
            'correction.*.qty_in' => ['nullable', 'integer'],
            'correction.*.qty_out' => ['nullable', 'integer'],
            'correction.*.operator_employee_id' => ['nullable', 'string'],
            'correction.*.supervisor_employee_id' => ['nullable', 'string'],
            'correction.*.machine_id' => ['nullable'],
            'correction.*.work_date' => ['nullable', 'date'],
            'correction.*.remarks' => ['nullable', 'string'],

            'corrective.what' => ['nullable', 'string'],
            'corrective.responsible_employee_id' => ['nullable', 'string'],
            'corrective.when' => ['nullable', 'date'],
            'corrective.status' => ['nullable', 'in:open,done'],
        ]);

        DB::transaction(function () use ($qdn, $data) {
            $round = $qdn->capa_round;
            $containmentChecked = $data['containment_checked'] ?? false;
            $correctionChecked = $data['correction_checked'] ?? false;

            // Only THIS round's rows are replaced -- earlier rounds (from
            // before a Dept Approval "Wrong" / QA "No" return) are left
            // untouched so the full CAPA history stays intact. See
            // QdnDetailCard's CAPA history section.
            QdnCapaContainmentLot::where('qdn_id', $qdn->id)->where('round', $round)->delete();
            if ($containmentChecked) {
                $sortOrder = 0;
                foreach ($data['containment'] ?? [] as $row) {
                    $employee = !empty($row['inspected_by_employee_id']) ? Employee::find($row['inspected_by_employee_id']) : null;
                    QdnCapaContainmentLot::create([
                        'qdn_id' => $qdn->id,
                        'round' => $round,
                        'date_processed' => $row['date_processed'] ?? null,
                        'lot_id' => $row['lot_id'] ?? null,
                        'part_name' => $row['part_name'] ?? null,
                        'qty' => $row['qty'] ?? null,
                        'inspected_by_employee_id' => $row['inspected_by_employee_id'] ?? null,
                        'inspected_by_name' => $employee?->EMPLOYNAME,
                        'status' => $row['status'] ?? null,
                        'remarks' => $row['remarks'] ?? null,
                        'result_of_inspection' => $row['result_of_inspection'] ?? null,
                        'sort_order' => $sortOrder++,
                    ]);
                }
            }

            QdnCapaCorrection::where('qdn_id', $qdn->id)->where('round', $round)->delete();
            if ($correctionChecked) {
                $sortOrder = 0;
                foreach ($data['correction'] ?? [] as $row) {
                    $operator = !empty($row['operator_employee_id']) ? Employee::find($row['operator_employee_id']) : null;
                    $supervisor = !empty($row['supervisor_employee_id']) ? Employee::find($row['supervisor_employee_id']) : null;
                    $machine = !empty($row['machine_id']) ? Machine::find($row['machine_id']) : null;
                    QdnCapaCorrection::create([
                        'qdn_id' => $qdn->id,
                        'round' => $round,
                        'activity' => $row['activity'] ?? null,
                        'qty_in' => $row['qty_in'] ?? null,
                        'qty_out' => $row['qty_out'] ?? null,
                        'operator_employee_id' => $row['operator_employee_id'] ?? null,
                        'operator_employee_name' => $operator?->EMPLOYNAME,
                        'supervisor_employee_id' => $row['supervisor_employee_id'] ?? null,
                        'supervisor_employee_name' => $supervisor?->EMPLOYNAME,
                        'machine_id' => $row['machine_id'] ?? null,
                        'machine_num' => $machine?->machine_num,
                        'work_date' => $row['work_date'] ?? null,
                        'remarks' => $row['remarks'] ?? null,
                        'sort_order' => $sortOrder++,
                    ]);
                }
            }

            $corrective = $data['corrective'] ?? [];
            $correctiveResponsible = !empty($corrective['responsible_employee_id'])
                ? Employee::find($corrective['responsible_employee_id'])
                : null;

            $qdn->update([
                'capa_containment_checked' => $containmentChecked,
                'capa_correction_checked' => $correctionChecked,
                'capa_corrective_what' => $corrective['what'] ?? null,
                'capa_corrective_responsible_employee_id' => $corrective['responsible_employee_id'] ?? null,
                'capa_corrective_responsible_name' => $correctiveResponsible?->EMPLOYNAME,
                'capa_corrective_when' => $corrective['when'] ?? null,
                'capa_corrective_status' => $corrective['status'] ?? null,
                'capa_submitted_by' => CurrentEmployee::name(),
                'capa_submitted_at' => now(),
                // A fresh submission supersedes whatever Dept Approval /
                // QA decided about the previous round -- reset so this
                // round starts out awaiting review again.
                'capa_approval_status' => null,
                'capa_approved_by' => null,
                'capa_approved_at' => null,
                'qa_capa_implemented' => null,
                'status' => Qdn::STATUS_FOR_DEPT_APPROVAL,
            ]);
        });

        // Per spec: CAPA submit goes back to the QDN record list, not the
        // CAPA queue (unlike every other stage's redirect in this file).
        return redirect()
            ->route('qdn.records.index')
            ->with('success', "CAPA submitted for QDN {$qdn->qdn_no}, routed for department approval.");
    }

    // -- Dept Approval ----------------------------------------------------

    public function approvalIndex(): Response
    {
        $department = CurrentEmployee::department();

        return Inertia::render('Qdn/Approval/Index', [
            'department' => $department,
            'qdns' => $department
                ? Qdn::where('status', Qdn::STATUS_FOR_DEPT_APPROVAL)
                    ->where('issued_department', $department)
                    ->orderBy('created_at')
                    ->get(self::SUMMARY_COLUMNS)
                : collect(),
        ]);
    }

    public function approvalShow(Qdn $qdn): Response
    {
        $this->assertOwningDepartment($qdn);
        abort_unless($qdn->status === Qdn::STATUS_FOR_DEPT_APPROVAL, 409, 'This QDN is not currently awaiting department approval.');

        // Eager-load everything QdnDetailCard's "Details of Issuance / PE
        // Validation / RCA / CAPA (+ history)" sections need -- this page
        // never loaded any of these before, so they silently rendered
        // nothing (same bug class already found and fixed on PE
        // Disposition's page).
        $qdn->load(['validation', 'rcaCauses', 'capaContainmentLots', 'capaCorrections', 'capaReturns']);

        return Inertia::render('Qdn/Approval/Show', [
            'qdn' => $qdn,
            // Whole department can see this queue/page; only Section
            // Head/Manager can submit the Correct/Wrong decision -- see
            // assertIsApprover(). The page uses this to disable the
            // decision buttons and show a notice instead of a raw 403.
            'canApprove' => CurrentEmployee::isApprover(),
        ]);
    }

    /**
     * Dept Approval of CAPA -- Correct routes to Department: QA for
     * verification. Wrong logs a QdnCapaReturn (stage=approval), bumps
     * capa_round so the department's next submission lands as a new round
     * instead of overwriting this one, and sends the QDN back to
     * STATUS_FOR_DEPT_CAPA. Remarks are required when marking Wrong so
     * the department knows what to fix.
     */
    public function approvalStore(Request $request, Qdn $qdn): RedirectResponse
    {
        $this->assertOwningDepartment($qdn);
        $this->assertIsApprover();
        abort_unless($qdn->status === Qdn::STATUS_FOR_DEPT_APPROVAL, 409, 'This QDN is not currently awaiting department approval.');

        $data = $request->validate([
            'decision' => ['required', 'in:correct,wrong'],
            'remarks' => ['nullable', 'string', 'required_if:decision,wrong'],
        ]);

        if ($data['decision'] === 'correct') {
            $qdn->update([
                'capa_approval_status' => Qdn::CAPA_APPROVAL_STATUS_CORRECT,
                'capa_approved_by' => CurrentEmployee::name(),
                'capa_approved_at' => now(),
                'capa_approval_remarks' => $data['remarks'] ?? null,
                'status' => Qdn::STATUS_FOR_QA_VERIFICATION,
            ]);
            $message = "CAPA marked Correct for QDN {$qdn->qdn_no}, routed to Department: QA for verification.";
        } else {
            DB::transaction(function () use ($qdn, $data) {
                QdnCapaReturn::create([
                    'qdn_id' => $qdn->id,
                    'round' => $qdn->capa_round,
                    'stage' => QdnCapaReturn::STAGE_APPROVAL,
                    'returned_by' => CurrentEmployee::name(),
                    'returned_at' => now(),
                    'remarks' => $data['remarks'],
                ]);

                $qdn->update([
                    'capa_approval_status' => Qdn::CAPA_APPROVAL_STATUS_WRONG,
                    'capa_approved_by' => null,
                    'capa_approved_at' => null,
                    'capa_approval_remarks' => $data['remarks'],
                    'capa_round' => $qdn->capa_round + 1,
                    'status' => Qdn::STATUS_FOR_DEPT_CAPA,
                ]);
            });
            $message = "CAPA marked Wrong for QDN {$qdn->qdn_no}, returned to {$qdn->issued_department} to update CAPA.";
        }

        return redirect()->route('qdn.approval.index')->with('success', $message);
    }

    // -- QA Verification --------------------------------------------------

    public function qaIndex(): Response
    {
        $this->assertIsQa();

        return Inertia::render('Qdn/QaVerification/Index', [
            'qdns' => Qdn::where('status', Qdn::STATUS_FOR_QA_VERIFICATION)
                ->orderBy('created_at')
                ->get(self::SUMMARY_COLUMNS),
        ]);
    }

    public function qaShow(Qdn $qdn): Response
    {
        $this->assertIsQa();
        abort_unless($qdn->status === Qdn::STATUS_FOR_QA_VERIFICATION, 409, 'This QDN is not currently awaiting QA verification.');

        // Same eager-load fix as approvalShow() -- "Details of Issuance /
        // PE Validation / RCA / CAPA Details + Approval Details" per spec.
        $qdn->load(['validation', 'rcaCauses', 'capaContainmentLots', 'capaCorrections', 'capaReturns']);

        return Inertia::render('Qdn/QaVerification/Show', ['qdn' => $qdn]);
    }

    /**
     * QA Verification -- "Corrective Action implemented?" Yes closes the
     * QDN (also records "Verification of Effectiveness" into
     * qa_verification_remarks). No logs a QdnCapaReturn (stage=qa), bumps
     * capa_round, resets capa_approval_status (the previous round's Dept
     * Approval decision no longer applies to the round that's coming),
     * and sends the QDN back to STATUS_FOR_DEPT_CAPA -- it goes through
     * Dept Approval again once resubmitted, same as any other CAPA
     * update.
     */
    public function qaStore(Request $request, Qdn $qdn): RedirectResponse
    {
        $this->assertIsQa();
        abort_unless($qdn->status === Qdn::STATUS_FOR_QA_VERIFICATION, 409, 'This QDN is not currently awaiting QA verification.');

        $data = $request->validate([
            'capa_implemented' => ['required', 'in:yes,no'],
            // Doubles as "Verification of Effectiveness" (required when
            // Yes) and as the return remarks (optional when No).
            'notes' => ['nullable', 'string', 'required_if:capa_implemented,yes'],
        ]);

        if ($data['capa_implemented'] === 'yes') {
            $qdn->update([
                'qa_capa_implemented' => Qdn::QA_CAPA_IMPLEMENTED_YES,
                'qa_verified_by' => CurrentEmployee::name(),
                'qa_verified_at' => now(),
                'qa_verification_remarks' => $data['notes'] ?? null,
                'status' => Qdn::STATUS_CLOSED,
            ]);
            $message = "QDN {$qdn->qdn_no} verified by QA and closed.";
        } else {
            DB::transaction(function () use ($qdn, $data) {
                QdnCapaReturn::create([
                    'qdn_id' => $qdn->id,
                    'round' => $qdn->capa_round,
                    'stage' => QdnCapaReturn::STAGE_QA,
                    'returned_by' => CurrentEmployee::name(),
                    'returned_at' => now(),
                    'remarks' => $data['notes'] ?? null,
                ]);

                $qdn->update([
                    'qa_capa_implemented' => Qdn::QA_CAPA_IMPLEMENTED_NO,
                    'qa_verified_by' => null,
                    'qa_verified_at' => null,
                    'qa_verification_remarks' => $data['notes'] ?? null,
                    'capa_approval_status' => null,
                    'capa_round' => $qdn->capa_round + 1,
                    'status' => Qdn::STATUS_FOR_DEPT_CAPA,
                ]);
            });
            $message = "QDN {$qdn->qdn_no} sent back to {$qdn->issued_department} for CAPA rework (corrective action not implemented).";
        }

        return redirect()->route('qa.verification.index')->with('success', $message);
    }
}
