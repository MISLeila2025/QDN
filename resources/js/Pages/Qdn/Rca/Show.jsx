import { useForm, Head } from '@inertiajs/react';
import { AlertTriangle, ArrowUpRight, Settings } from 'lucide-react';
import QdnDetailCard from '@/Components/QdnDetailCard';
import EmployeeSearchSelect from '@/Components/EmployeeSearchSelect';
import { Timeline, TimelineItem } from '@/Components/Timeline';
import BackLink from '@/Components/BackLink';

const EMPTY_ROW = {
    reason_root_cause_id: '',
    cause: '',
    defect_source_id: '',
    responsible_employee_id: '',
    responsible_employee_name: '',
    issued_to: [],
};

// Case-insensitive/trimmed match, same convention as
// App\Models\Defect::isMan() on the backend -- keeps working even if the
// defect_source table gets re-seeded/reordered later.
function isManDefect(defects, defectSourceId) {
    if (!defectSourceId) return false;
    const selected = defects.find((d) => String(d.id) === String(defectSourceId));
    return (selected?.label ?? '').trim().toLowerCase() === 'man';
}

/**
 * Submit Root Cause Analysis for a QDN -- three repeatable sections (Root
 * Cause of Event / Root Cause of Escape / System Cause), each row a
 * Select Cause (reason_root_cause) + free-text Cause + Source of Defect
 * (defect_source, app-owned static lookup: Man/Machine/Materials/Method/
 * Environment/Systems) + Select Responsible, now a server-side type-ahead
 * (EmployeeSearchSelect) scoped to this QDN's issued_department.
 *
 * When a row's Source of Defect is "Man", an extra "Issued To" section
 * appears on that row: the same type-ahead employee picker + "Add to
 * list" button building a repeatable list, summarized in a table (Emp No
 * / Name / Department / Station / Productline / Action).
 *
 * `canSubmit` is false for anyone below Supervisor -- the whole
 * department can still open and fill out this form, but only Supervisor,
 * Section Head, or Manager can actually submit it (see
 * QdnWorkflowController@assertCanAnswerRcaOrCapa). The Submit button is
 * disabled with an explanatory notice rather than letting someone fill
 * the whole form out and hit a 403 at the end.
 *
 * Props (from QdnWorkflowController@rcaShow): qdn, canSubmit, event,
 * escape, system (each an array of existing rows, pre-filled if this RCA
 * was previously submitted and sent back by PE -- each row now also
 * carries responsible_employee_name and its issued_to array),
 * reasonRootCauses, defects.
 */
export default function RcaShow({ qdn, canSubmit, event, escape, system, reasonRootCauses, defects }) {
    const { data, setData, post, processing, errors } = useForm({
        event: event.length ? event : [{ ...EMPTY_ROW }],
        escape: escape.length ? escape : [{ ...EMPTY_ROW }],
        system: system.length ? system : [{ ...EMPTY_ROW }],
    });

    function updateRow(group, index, field, value) {
        const rows = data[group].slice();
        let updatedRow = { ...rows[index], [field]: value };

        // Switching Source of Defect away from "Man" drops any
        // already-added Issued To entries -- they'd never be persisted
        // server-side anyway (syncRcaCauses() only saves them when the
        // row's defect resolves to Man), so this keeps the form honest.
        if (field === 'defect_source_id' && !isManDefect(defects, value)) {
            updatedRow = { ...updatedRow, issued_to: [] };
        }

        rows[index] = updatedRow;
        setData(group, rows);
    }

    function updateResponsible(group, index, employee) {
        const rows = data[group].slice();
        rows[index] = {
            ...rows[index],
            responsible_employee_id: employee?.EMPLOYID ?? '',
            responsible_employee_name: employee?.EMPLOYNAME ?? '',
        };
        setData(group, rows);
    }

    function addRow(group) {
        setData(group, [...data[group], { ...EMPTY_ROW }]);
    }

    function removeRow(group, index) {
        const rows = data[group].slice();
        rows.splice(index, 1);
        setData(group, rows.length ? rows : [{ ...EMPTY_ROW }]);
    }

    function addIssuedTo(group, rowIndex, employee) {
        if (!employee?.EMPLOYID) return;

        const rows = data[group].slice();
        const row = rows[rowIndex];
        const existing = row.issued_to ?? [];

        // No duplicate entries for the same employee on the same row.
        if (existing.some((e) => e.employee_id === employee.EMPLOYID)) return;

        rows[rowIndex] = {
            ...row,
            issued_to: [
                ...existing,
                {
                    employee_id: employee.EMPLOYID,
                    employee_name: employee.EMPLOYNAME,
                    department: employee.DEPARTMENT,
                    station: employee.STATION,
                    prodline: employee.PRODLINE,
                },
            ],
        };
        setData(group, rows);
    }

    function removeIssuedTo(group, rowIndex, issuedIndex) {
        const rows = data[group].slice();
        const row = rows[rowIndex];
        const issued = (row.issued_to ?? []).slice();
        issued.splice(issuedIndex, 1);
        rows[rowIndex] = { ...row, issued_to: issued };
        setData(group, rows);
    }

    function handleSubmit(e) {
        e.preventDefault();
        post(`/qdn/rca/${qdn.id}`);
    }

    return (
        <div className="qdn-page" style={{ maxWidth: 1100 }}>
            <Head title={`RCA — ${qdn.qdn_no}`} />
            <BackLink href="/qdn/rca" label="Back to Dept RCA queue" />
            <h1>Root Cause Analysis — {qdn.qdn_no}</h1>

            <QdnDetailCard qdn={qdn} />

            <form onSubmit={handleSubmit}>
                <Timeline>
                    <TimelineItem icon={AlertTriangle} title="Root Cause of Event">
                        <RcaCauseGroup
                            addLabel="+ add event"
                            group="event"
                            rows={data.event}
                            errors={errors}
                            reasonRootCauses={reasonRootCauses}
                            defects={defects}
                            onChange={updateRow}
                            onResponsibleChange={updateResponsible}
                            onAdd={addRow}
                            onRemove={removeRow}
                            onAddIssued={addIssuedTo}
                            onRemoveIssued={removeIssuedTo}
                        />
                    </TimelineItem>

                    <TimelineItem icon={ArrowUpRight} title="Root Cause of Escape">
                        <RcaCauseGroup
                            addLabel="+ add escape"
                            group="escape"
                            rows={data.escape}
                            errors={errors}
                            reasonRootCauses={reasonRootCauses}
                            defects={defects}
                            onChange={updateRow}
                            onResponsibleChange={updateResponsible}
                            onAdd={addRow}
                            onRemove={removeRow}
                            onAddIssued={addIssuedTo}
                            onRemoveIssued={removeIssuedTo}
                        />
                    </TimelineItem>

                    <TimelineItem icon={Settings} title="System Cause">
                        <RcaCauseGroup
                            addLabel="+ add system"
                            group="system"
                            rows={data.system}
                            errors={errors}
                            reasonRootCauses={reasonRootCauses}
                            defects={defects}
                            onChange={updateRow}
                            onResponsibleChange={updateResponsible}
                            onAdd={addRow}
                            onRemove={removeRow}
                            onAddIssued={addIssuedTo}
                            onRemoveIssued={removeIssuedTo}
                        />
                    </TimelineItem>
                </Timeline>

                {!canSubmit && (
                    <p className="qdn-restricted-notice">
                        Only Supervisor, Section Head, or Manager can submit RCA. You can still fill this out, but
                        submitting requires someone at that level to sign in and click Submit.
                    </p>
                )}

                <div className="qdn-dashboard-section">
                    <button type="submit" className="qdn-btn" disabled={processing || !canSubmit}>
                        Submit
                    </button>
                </div>
            </form>
        </div>
    );
}

function RcaCauseGroup({
    addLabel,
    group,
    rows,
    errors,
    reasonRootCauses,
    defects,
    onChange,
    onResponsibleChange,
    onAdd,
    onRemove,
    onAddIssued,
    onRemoveIssued,
}) {
    return (
        <>
            {rows.map((row, index) => (
                <CauseRow
                    key={index}
                    group={group}
                    index={index}
                    row={row}
                    defects={defects}
                    reasonRootCauses={reasonRootCauses}
                    onChange={onChange}
                    onResponsibleChange={onResponsibleChange}
                    onRemove={onRemove}
                    onAddIssued={onAddIssued}
                    onRemoveIssued={onRemoveIssued}
                />
            ))}
            {errors[group] && <p className="qdn-field-error">{errors[group]}</p>}

            <button type="button" className="qdn-btn" onClick={() => onAdd(group)}>
                {addLabel}
            </button>
        </>
    );
}

function CauseRow({
    group,
    index,
    row,
    defects,
    reasonRootCauses,
    onChange,
    onResponsibleChange,
    onRemove,
    onAddIssued,
    onRemoveIssued,
}) {
    const showIssuedTo = isManDefect(defects, row.defect_source_id);

    const responsibleValue = row.responsible_employee_id
        ? { EMPLOYID: row.responsible_employee_id, EMPLOYNAME: row.responsible_employee_name }
        : null;

    return (
        <div className="qdn-cause-row">
            <div className="qdn-cause-row-fields">
                <div className="qdn-field">
                    <label>Select Cause</label>
                    <select
                        value={row.reason_root_cause_id ?? ''}
                        onChange={(e) => onChange(group, index, 'reason_root_cause_id', e.target.value)}
                    >
                        <option value="">-- Select Cause --</option>
                        {reasonRootCauses.map((r) => (
                            <option key={r.id} value={r.id}>
                                {r.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="qdn-field">
                    <label>Cause</label>
                    <input
                        type="text"
                        value={row.cause ?? ''}
                        onChange={(e) => onChange(group, index, 'cause', e.target.value)}
                    />
                </div>

                <div className="qdn-field">
                    <label>Source of Defect</label>
                    <select
                        value={row.defect_source_id ?? ''}
                        onChange={(e) => onChange(group, index, 'defect_source_id', e.target.value)}
                    >
                        <option value="">-- Source of Defect --</option>
                        {defects.map((d) => (
                            <option key={d.id} value={d.id}>
                                {d.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="qdn-field">
                    <label>Select Responsible</label>
                    <EmployeeSearchSelect
                        value={responsibleValue}
                        onChange={(employee) => onResponsibleChange(group, index, employee)}
                    />
                </div>

                <button
                    type="button"
                    className="qdn-btn qdn-btn-secondary"
                    onClick={() => onRemove(group, index)}
                >
                    Remove
                </button>
            </div>

            {showIssuedTo && (
                <div className="qdn-issued-to">
                    <h4>Issued To</h4>
                    <div className="qdn-issued-to-picker">
                        <EmployeeSearchSelect
                            value={null}
                            placeholder="Search employee to add…"
                            onChange={(employee) => onAddIssued(group, index, employee)}
                        />
                    </div>

                    {row.issued_to?.length > 0 && (
                        <table className="qdn-table">
                            <thead>
                                <tr>
                                    <th>Emp No</th>
                                    <th>Name</th>
                                    <th>Department</th>
                                    <th>Station</th>
                                    <th>Productline</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {row.issued_to.map((e, issuedIndex) => (
                                    <tr key={e.employee_id}>
                                        <td>{e.employee_id}</td>
                                        <td>{e.employee_name}</td>
                                        <td>{e.department}</td>
                                        <td>{e.station}</td>
                                        <td>{e.prodline}</td>
                                        <td>
                                            <button
                                                type="button"
                                                className="qdn-btn qdn-btn-secondary"
                                                onClick={() => onRemoveIssued(group, index, issuedIndex)}
                                            >
                                                Remove
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
}
