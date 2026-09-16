import { useForm, Head } from "@inertiajs/react";
import { CheckSquare, ShieldCheck, Wrench } from "lucide-react";
import QdnDetailCard from "@/Components/QdnDetailCard";
import RichTextEditor from "@/Components/RichTextEditor";
import EmployeeSearchSelect from "@/Components/EmployeeSearchSelect";
import { Timeline, TimelineItem } from "@/Components/Timeline";
import BackLink from "@/Components/BackLink";

const EMPTY_CONTAINMENT_ROW = {
    date_processed: "",
    lot_id: "",
    part_name: "",
    qty: "",
    inspected_by_employee_id: "",
    inspected_by_name: "",
    status: "",
    remarks: "",
    result_of_inspection: "",
};

const EMPTY_CORRECTION_ROW = {
    activity: "",
    qty_in: "",
    qty_out: "",
    operator_employee_id: "",
    operator_employee_name: "",
    supervisor_employee_id: "",
    supervisor_employee_name: "",
    machine_id: "",
    work_date: "",
    remarks: "",
};

// Inspected By: FVI Inspector 1/2
const INSPECTOR_TITLES = ["FVI Inspector 1", "FVI Inspector 2"];
// Select Operator/FVI/OQA: FVI Inspector 1/2, QA Inspector 1/2, or *Operator*
const OPERATOR_TITLES = [
    "FVI Inspector 1",
    "FVI Inspector 2",
    "QA Inspector 1",
    "QA Inspector 2",
];
const OPERATOR_LIKE = ["%Operator%"];
// Select Supervisor: *Supervisor*
const SUPERVISOR_LIKE = ["%Supervisor%"];

/**
 * Submit Corrective & Preventive Action for a QDN, once PE has approved
 * its RCA:
 *   Containment Action ("Insert 3 lots before and after") -- repeatable
 *   lot rows, only saved if the checkbox is checked.
 *   Correction Action ("Rework Traveller") -- repeatable rows, only
 *   saved if the checkbox is checked.
 *   Corrective Action -- a single What/Responsible/When/Status set.
 *
 * Every "select an employee" field (Inspected By, Operator/FVI/OQA,
 * Supervisor, Corrective Action Responsible) is a server-side type-ahead
 * (EmployeeSearchSelect -> GET /employees/search) instead of a preloaded
 * dropdown -- each row carries both the employee's id and name so the
 * summary tables below don't need the old full roster lookups.
 *
 * `lastReturn` (present when qdn.capa_round > 1) is the most recent Dept
 * Approval "Wrong" / QA "No" return -- shown as a banner so whoever is
 * updating CAPA can see why it came back without digging through
 * QdnDetailCard's full history section. The fields below are prefilled
 * from that same latest round so nothing has to be retyped; submitting
 * saves them as a NEW round (qdn.capa_round) rather than overwriting the
 * one that got returned -- see QdnWorkflowController@capaShow/capaStore.
 *
 * `canSubmit` is false for anyone below Supervisor -- same "visible to
 * all, action restricted" pattern as Rca/Show.jsx (see
 * QdnWorkflowController@assertCanAnswerRcaOrCapa).
 *
 * Props (from QdnWorkflowController@capaShow): qdn, canSubmit, lastReturn,
 * containmentChecked, containment, correctionChecked, correction,
 * correctiveAction, machines
 */
export default function CapaShow({
    qdn,
    canSubmit,
    lastReturn,
    containmentChecked,
    containment,
    correctionChecked,
    correction,
    correctiveAction,
    machines,
}) {
    const { data, setData, post, processing, errors } = useForm({
        containment_checked: containmentChecked,
        containment,
        correction_checked: correctionChecked,
        correction,
        corrective: {
            what: correctiveAction.what || "",
            responsible_employee_id:
                correctiveAction.responsible_employee_id || "",
            responsible_employee_name:
                correctiveAction.responsible_employee_name || "",
            when: correctiveAction.when || "",
            status: correctiveAction.status || "",
        },
    });

    function toggleContainment(e) {
        const checked = e.target.checked;
        setData("containment_checked", checked);
        if (checked && data.containment.length === 0) {
            // "Insert 3 lots before and after" -- default to 3 rows the
            // first time this is checked; "+ add row" covers anything past that.
            setData("containment", [
                { ...EMPTY_CONTAINMENT_ROW },
                { ...EMPTY_CONTAINMENT_ROW },
                { ...EMPTY_CONTAINMENT_ROW },
            ]);
        }
    }

    function toggleCorrection(e) {
        const checked = e.target.checked;
        setData("correction_checked", checked);
        if (checked && data.correction.length === 0) {
            setData("correction", [{ ...EMPTY_CORRECTION_ROW }]);
        }
    }

    function updateContainmentRow(index, field, value) {
        const rows = data.containment.slice();
        rows[index] = { ...rows[index], [field]: value };
        setData("containment", rows);
    }

    function updateContainmentInspector(index, employee) {
        const rows = data.containment.slice();
        rows[index] = {
            ...rows[index],
            inspected_by_employee_id: employee?.EMPLOYID ?? "",
            inspected_by_name: employee?.EMPLOYNAME ?? "",
        };
        setData("containment", rows);
    }

    function addContainmentRow() {
        setData("containment", [
            ...data.containment,
            { ...EMPTY_CONTAINMENT_ROW },
        ]);
    }

    function removeContainmentRow(index) {
        const rows = data.containment.slice();
        rows.splice(index, 1);
        setData("containment", rows);
    }

    function updateCorrectionRow(index, field, value) {
        const rows = data.correction.slice();
        rows[index] = { ...rows[index], [field]: value };
        setData("correction", rows);
    }

    function updateCorrectionOperator(index, employee) {
        const rows = data.correction.slice();
        rows[index] = {
            ...rows[index],
            operator_employee_id: employee?.EMPLOYID ?? "",
            operator_employee_name: employee?.EMPLOYNAME ?? "",
        };
        setData("correction", rows);
    }

    function updateCorrectionSupervisor(index, employee) {
        const rows = data.correction.slice();
        rows[index] = {
            ...rows[index],
            supervisor_employee_id: employee?.EMPLOYID ?? "",
            supervisor_employee_name: employee?.EMPLOYNAME ?? "",
        };
        setData("correction", rows);
    }

    function addCorrectionRow() {
        setData("correction", [
            ...data.correction,
            { ...EMPTY_CORRECTION_ROW },
        ]);
    }

    function removeCorrectionRow(index) {
        const rows = data.correction.slice();
        rows.splice(index, 1);
        setData("correction", rows);
    }

    function updateCorrective(field, value) {
        setData("corrective", { ...data.corrective, [field]: value });
    }

    function updateCorrectiveResponsible(employee) {
        setData("corrective", {
            ...data.corrective,
            responsible_employee_id: employee?.EMPLOYID ?? "",
            responsible_employee_name: employee?.EMPLOYNAME ?? "",
        });
    }

    function handleSubmit(e) {
        e.preventDefault();
        post(`/qdn/capa/${qdn.id}`);
    }

    const correctiveResponsibleValue = data.corrective.responsible_employee_id
        ? {
              EMPLOYID: data.corrective.responsible_employee_id,
              EMPLOYNAME: data.corrective.responsible_employee_name,
          }
        : null;

    return (
        <div className="qdn-page" style={{ maxWidth: 1200 }}>
            <Head title={`CAPA — ${qdn.qdn_no}`} />
            <BackLink href="/qdn/capa" label="Back to Dept CAPA queue" />
            <h1>Corrective &amp; Preventive Actions (CAPA) — {qdn.qdn_no}</h1>

            <QdnDetailCard qdn={qdn} />

            {lastReturn && (
                <div className="qdn-return-banner">
                    <strong>Returned for update</strong> by{" "}
                    {lastReturn.returned_by ?? "—"}
                    {lastReturn.stage === "qa"
                        ? " (QA Verification)"
                        : " (Dept Approval)"}
                    {lastReturn.returned_at
                        ? ` on ${new Date(lastReturn.returned_at).toLocaleString()}`
                        : ""}
                    {lastReturn.remarks ? `: "${lastReturn.remarks}"` : ""}
                    <br />
                    Update and resubmit below — this becomes round{" "}
                    {qdn.capa_round}. Round {lastReturn.round} stays visible in
                    this QDN's CAPA history once you submit.
                </div>
            )}

            <form onSubmit={handleSubmit}>
                <Timeline>
                    <TimelineItem icon={ShieldCheck} title="Containment Action">
                        <label className="qdn-checkbox">
                            <input
                                type="checkbox"
                                checked={data.containment_checked}
                                onChange={toggleContainment}
                            />
                            Insert 3 lots before and after
                        </label>

                        {data.containment_checked && (
                            <>
                                <table
                                    className="qdn-table"
                                    style={{ marginTop: 12 }}
                                >
                                    <thead>
                                        <tr>
                                            <th>Date Processed</th>
                                            <th>Lot ID</th>
                                            <th>Part Name</th>
                                            <th>Qty</th>
                                            <th style={{ minWidth: 200 }}>
                                                Inspected By
                                            </th>
                                            <th>Status</th>
                                            <th style={{ minWidth: 220 }}>
                                                Remarks
                                            </th>
                                            <th>Result of Inspection</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.containment.map((row, index) => (
                                            <tr key={index}>
                                                <td>
                                                    <input
                                                        type="datetime-local"
                                                        value={
                                                            row.date_processed ??
                                                            ""
                                                        }
                                                        onChange={(e) =>
                                                            updateContainmentRow(
                                                                index,
                                                                "date_processed",
                                                                e.target.value,
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="text"
                                                        value={row.lot_id ?? ""}
                                                        onChange={(e) =>
                                                            updateContainmentRow(
                                                                index,
                                                                "lot_id",
                                                                e.target.value,
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="text"
                                                        value={
                                                            row.part_name ?? ""
                                                        }
                                                        onChange={(e) =>
                                                            updateContainmentRow(
                                                                index,
                                                                "part_name",
                                                                e.target.value,
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        style={{ width: 80 }}
                                                        value={row.qty ?? ""}
                                                        onChange={(e) =>
                                                            updateContainmentRow(
                                                                index,
                                                                "qty",
                                                                e.target.value,
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td>
                                                    <EmployeeSearchSelect
                                                        compact
                                                        value={
                                                            row.inspected_by_employee_id
                                                                ? {
                                                                      EMPLOYID:
                                                                          row.inspected_by_employee_id,
                                                                      EMPLOYNAME:
                                                                          row.inspected_by_name,
                                                                  }
                                                                : null
                                                        }
                                                        titles={
                                                            INSPECTOR_TITLES
                                                        }
                                                        placeholder="Inspector…"
                                                        onChange={(employee) =>
                                                            updateContainmentInspector(
                                                                index,
                                                                employee,
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td>
                                                    <select
                                                        value={row.status ?? ""}
                                                        onChange={(e) =>
                                                            updateContainmentRow(
                                                                index,
                                                                "status",
                                                                e.target.value,
                                                            )
                                                        }
                                                    >
                                                        <option value="">
                                                            --
                                                        </option>
                                                        <option value="open">
                                                            Open
                                                        </option>
                                                        <option value="done">
                                                            Done
                                                        </option>
                                                    </select>
                                                </td>
                                                <td>
                                                    <RichTextEditor
                                                        value={row.remarks}
                                                        onChange={(html) =>
                                                            updateContainmentRow(
                                                                index,
                                                                "remarks",
                                                                html,
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="text"
                                                        value={
                                                            row.result_of_inspection ??
                                                            ""
                                                        }
                                                        onChange={(e) =>
                                                            updateContainmentRow(
                                                                index,
                                                                "result_of_inspection",
                                                                e.target.value,
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="qdn-btn qdn-btn-secondary"
                                                        onClick={() =>
                                                            removeContainmentRow(
                                                                index,
                                                            )
                                                        }
                                                    >
                                                        Remove
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {errors.containment && (
                                    <p className="qdn-field-error">
                                        {errors.containment}
                                    </p>
                                )}
                                <button
                                    type="button"
                                    className="qdn-btn"
                                    onClick={addContainmentRow}
                                >
                                    + add row
                                </button>

                                <h3 style={{ marginTop: 20 }}>
                                    Summary of lots
                                </h3>
                                <table className="qdn-table">
                                    <thead>
                                        <tr>
                                            <th>Date Processed</th>
                                            <th>Lot ID</th>
                                            <th>Part Name</th>
                                            <th>Qty</th>
                                            <th>Inspected By</th>
                                            <th>Status</th>
                                            <th>Remarks</th>
                                            <th>Results of Inspection</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.containment.length === 0 && (
                                            <tr>
                                                <td colSpan={8}>
                                                    No lots added yet.
                                                </td>
                                            </tr>
                                        )}
                                        {data.containment.map((row, index) => (
                                            <tr key={index}>
                                                <td>
                                                    {row.date_processed || "—"}
                                                </td>
                                                <td>{row.lot_id || "—"}</td>
                                                <td>{row.part_name || "—"}</td>
                                                <td>{row.qty || "—"}</td>
                                                <td>
                                                    {row.inspected_by_name ||
                                                        "—"}
                                                </td>
                                                <td>{row.status || "—"}</td>
                                                <td
                                                    dangerouslySetInnerHTML={{
                                                        __html:
                                                            row.remarks || "—",
                                                    }}
                                                />
                                                <td>
                                                    {row.result_of_inspection ||
                                                        "—"}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </>
                        )}
                    </TimelineItem>

                    <TimelineItem icon={Wrench} title="Correction Action">
                        <label className="qdn-checkbox">
                            <input
                                type="checkbox"
                                checked={data.correction_checked}
                                onChange={toggleCorrection}
                            />
                            Rework Traveller
                        </label>

                        {data.correction_checked && (
                            <>
                                <table
                                    className="qdn-table"
                                    style={{ marginTop: 12 }}
                                >
                                    <thead>
                                        <tr>
                                            <th>Activity</th>
                                            <th>Qty In</th>
                                            <th>Qty Out</th>
                                            <th style={{ minWidth: 200 }}>
                                                Select Operator/FVI/OQA
                                            </th>
                                            <th style={{ minWidth: 200 }}>
                                                Select Supervisor
                                            </th>
                                            <th>Machine No</th>
                                            <th>Date</th>
                                            <th style={{ minWidth: 220 }}>
                                                Remarks
                                            </th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.correction.map((row, index) => (
                                            <tr key={index}>
                                                <td>
                                                    <input
                                                        type="text"
                                                        value={
                                                            row.activity ?? ""
                                                        }
                                                        onChange={(e) =>
                                                            updateCorrectionRow(
                                                                index,
                                                                "activity",
                                                                e.target.value,
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        style={{ width: 80 }}
                                                        value={row.qty_in ?? ""}
                                                        onChange={(e) =>
                                                            updateCorrectionRow(
                                                                index,
                                                                "qty_in",
                                                                e.target.value,
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        style={{ width: 80 }}
                                                        value={
                                                            row.qty_out ?? ""
                                                        }
                                                        onChange={(e) =>
                                                            updateCorrectionRow(
                                                                index,
                                                                "qty_out",
                                                                e.target.value,
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td>
                                                    <EmployeeSearchSelect
                                                        compact
                                                        value={
                                                            row.operator_employee_id
                                                                ? {
                                                                      EMPLOYID:
                                                                          row.operator_employee_id,
                                                                      EMPLOYNAME:
                                                                          row.operator_employee_name,
                                                                  }
                                                                : null
                                                        }
                                                        titles={OPERATOR_TITLES}
                                                        like={OPERATOR_LIKE}
                                                        placeholder="Operator/FVI/OQA…"
                                                        onChange={(employee) =>
                                                            updateCorrectionOperator(
                                                                index,
                                                                employee,
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td>
                                                    <EmployeeSearchSelect
                                                        compact
                                                        value={
                                                            row.supervisor_employee_id
                                                                ? {
                                                                      EMPLOYID:
                                                                          row.supervisor_employee_id,
                                                                      EMPLOYNAME:
                                                                          row.supervisor_employee_name,
                                                                  }
                                                                : null
                                                        }
                                                        like={SUPERVISOR_LIKE}
                                                        placeholder="Supervisor…"
                                                        onChange={(employee) =>
                                                            updateCorrectionSupervisor(
                                                                index,
                                                                employee,
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td>
                                                    <select
                                                        value={
                                                            row.machine_id ?? ""
                                                        }
                                                        onChange={(e) =>
                                                            updateCorrectionRow(
                                                                index,
                                                                "machine_id",
                                                                e.target.value,
                                                            )
                                                        }
                                                    >
                                                        <option value="">
                                                            -- Machine --
                                                        </option>
                                                        {machines.map((m) => (
                                                            <option
                                                                key={m.id}
                                                                value={m.id}
                                                            >
                                                                {m.machine_num}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td>
                                                    <input
                                                        type="date"
                                                        value={
                                                            row.work_date ?? ""
                                                        }
                                                        onChange={(e) =>
                                                            updateCorrectionRow(
                                                                index,
                                                                "work_date",
                                                                e.target.value,
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td>
                                                    <RichTextEditor
                                                        value={row.remarks}
                                                        onChange={(html) =>
                                                            updateCorrectionRow(
                                                                index,
                                                                "remarks",
                                                                html,
                                                            )
                                                        }
                                                    />
                                                </td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="qdn-btn qdn-btn-secondary"
                                                        onClick={() =>
                                                            removeCorrectionRow(
                                                                index,
                                                            )
                                                        }
                                                    >
                                                        Remove
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {errors.correction && (
                                    <p className="qdn-field-error">
                                        {errors.correction}
                                    </p>
                                )}
                                <button
                                    type="button"
                                    className="qdn-btn"
                                    onClick={addCorrectionRow}
                                >
                                    + add row
                                </button>

                                <h3 style={{ marginTop: 20 }}>
                                    Summary of Work Traveller
                                </h3>
                                <table className="qdn-table">
                                    <thead>
                                        <tr>
                                            <th>Activity</th>
                                            <th>Qty In</th>
                                            <th>Qty Out</th>
                                            <th>Operator/FVI/OQA</th>
                                            <th>Supervisor</th>
                                            <th>Machine No</th>
                                            <th>Date</th>
                                            <th>Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.correction.length === 0 && (
                                            <tr>
                                                <td colSpan={8}>
                                                    No correction rows added
                                                    yet.
                                                </td>
                                            </tr>
                                        )}
                                        {data.correction.map((row, index) => {
                                            const machine = machines.find(
                                                (m) =>
                                                    String(m.id) ===
                                                    String(row.machine_id),
                                            );
                                            return (
                                                <tr key={index}>
                                                    <td>
                                                        {row.activity || "—"}
                                                    </td>
                                                    <td>{row.qty_in || "—"}</td>
                                                    <td>
                                                        {row.qty_out || "—"}
                                                    </td>
                                                    <td>
                                                        {row.operator_employee_name ||
                                                            "—"}
                                                    </td>
                                                    <td>
                                                        {row.supervisor_employee_name ||
                                                            "—"}
                                                    </td>
                                                    <td>
                                                        {machine?.machine_num ??
                                                            "—"}
                                                    </td>
                                                    <td>
                                                        {row.work_date || "—"}
                                                    </td>
                                                    <td
                                                        dangerouslySetInnerHTML={{
                                                            __html:
                                                                row.remarks ||
                                                                "—",
                                                        }}
                                                    />
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </>
                        )}
                    </TimelineItem>

                    <TimelineItem icon={CheckSquare} title="Corrective Action">
                        <div className="qdn-form">
                            <div className="qdn-field qdn-field-wide">
                                <label htmlFor="corrective_what">What</label>
                                <textarea
                                    id="corrective_what"
                                    rows={3}
                                    value={data.corrective.what}
                                    onChange={(e) =>
                                        updateCorrective("what", e.target.value)
                                    }
                                />
                            </div>
                            <div className="qdn-field">
                                <label htmlFor="corrective_responsible">
                                    Responsible
                                </label>
                                <EmployeeSearchSelect
                                    value={correctiveResponsibleValue}
                                    onChange={updateCorrectiveResponsible}
                                />
                            </div>
                            <div className="qdn-field">
                                <label htmlFor="corrective_when">When</label>
                                <input
                                    id="corrective_when"
                                    type="date"
                                    value={data.corrective.when}
                                    onChange={(e) =>
                                        updateCorrective("when", e.target.value)
                                    }
                                />
                            </div>
                            <div className="qdn-field">
                                <label htmlFor="corrective_status">
                                    Status
                                </label>
                                <select
                                    id="corrective_status"
                                    value={data.corrective.status}
                                    onChange={(e) =>
                                        updateCorrective(
                                            "status",
                                            e.target.value,
                                        )
                                    }
                                >
                                    <option value="">--</option>
                                    <option value="open">Open</option>
                                    <option value="done">Done</option>
                                </select>
                            </div>
                        </div>
                    </TimelineItem>
                </Timeline>

                {!canSubmit && (
                    <p className="qdn-restricted-notice">
                        Only Supervisor, Section Head, or Manager can submit
                        CAPA. You can still fill this out, but submitting
                        requires someone at that level to sign in and click
                        Submit.
                    </p>
                )}

                <div className="qdn-dashboard-section">
                    <button
                        type="submit"
                        className="qdn-btn"
                        disabled={processing || !canSubmit}
                    >
                        Submit
                    </button>
                </div>
            </form>
        </div>
    );
}
