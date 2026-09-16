import {
    AlertTriangle,
    ArrowUpRight,
    CheckSquare,
    RotateCcw,
    Settings,
    ShieldCheck,
    Stamp,
    Wrench,
} from "lucide-react";
import StatusRoadmap from "@/Components/StatusRoadmap";
import { Timeline, TimelineItem } from "@/Components/Timeline";

// Mirrors App\Models\Qdn::DISPOSITION_LABELS -- keep in sync if the six
// PE Disposition options ever change.
const DISPOSITION_LABELS = {
    rework: "Rework",
    split_lot: "Split Lot",
    shutdown: "Shutdown",
    shipback: "Shipback",
    use_as_is: "Use As Is",
    invalid: "Invalid",
};

/**
 * Read-only "everything about this QDN" card -- the base fields from
 * Create QDN, plus whichever of RCA / CAPA / Dept Approval / QA
 * Verification / original PE validation data has been recorded so far.
 * Shared by every workflow stage's Show page (Qdn/Rca/Show,
 * Qdn/PeRca/Show, Qdn/Capa/Show, Qdn/Approval/Show,
 * Qdn/QaVerification/Show) and Qdn/Records/Show, so the full record only
 * has to be laid out once.
 *
 * `qdn` may or may not have `validation` loaded (QdnController@recordShow
 * loads it; the per-stage controllers don't, since they only need the
 * base + in-progress workflow fields).
 */
export default function QdnDetailCard({ qdn }) {
    return (
        <>
            <StatusRoadmap status={qdn.status} />

            <section className="qdn-readonly-summary">
                <h2>Details of Issuance</h2>
                <dl>
                    <dt>QDN No</dt>
                    <dd>{qdn.qdn_no}</dd>
                    <dt>Status</dt>
                    <dd>{qdn.status_label ?? qdn.status}</dd>
                    <dt>Customer</dt>
                    <dd>{qdn.customer_name}</dd>
                    <dt>Lot ID</dt>
                    <dd>{qdn.lot_id}</dd>
                    <dt>Lot Qty</dt>
                    <dd>{qdn.lot_qty}</dd>
                    <dt>Device Name</dt>
                    <dd>{qdn.device_name}</dd>
                    <dt>Package Name</dt>
                    <dd>{qdn.package_name}</dd>
                    <dt>Machine No</dt>
                    <dd>{qdn.machine_num}</dd>
                    <dt>Detection Area</dt>
                    <dd>{qdn.detection_area}</dd>
                    <dt>Date &amp; Time of Detection</dt>
                    <dd>
                        {qdn.detected_at
                            ? new Date(qdn.detected_at).toLocaleString()
                            : "—"}
                    </dd>
                    <dt>Type of Non-Conformity / Failure Mode</dt>
                    <dd>{qdn.nonconformity_name}</dd>
                    <dt>Classification</dt>
                    <dd>{qdn.classification}</dd>
                    <dt>Issued By</dt>
                    <dd>{qdn.issued_by}</dd>
                    <dt>Issued Department</dt>
                    <dd>{qdn.issued_department ?? "—"}</dd>
                </dl>

                <h3>Details of Non-Conformity / Failure Mode</h3>
                <div
                    className="qdn-rte-content qdn-readonly-html"
                    dangerouslySetInnerHTML={{ __html: qdn.details }}
                />
            </section>

            {qdn.validation && (
                <section className="qdn-readonly-summary">
                    <h2>PE Validation</h2>
                    <dl>
                        <dt>Decision</dt>
                        <dd>{qdn.validation.is_valid ? "Valid" : "Invalid"}</dd>
                        <dt>Issued To</dt>
                        <dd>{qdn.validation.issued_to_name ?? "—"}</dd>
                        <dt>Department</dt>
                        <dd>{qdn.validation.department ?? "—"}</dd>
                        <dt>Station</dt>
                        <dd>{qdn.validation.station ?? "—"}</dd>
                        <dt>Product Line</dt>
                        <dd>{qdn.validation.prodline ?? "—"}</dd>
                        <dt>Team Responsible</dt>
                        <dd>{qdn.validation.team ?? "—"}</dd>
                        <dt>Validated By</dt>
                        <dd>{qdn.validation.validated_by ?? "—"}</dd>
                        <dt>Validated At</dt>
                        <dd>
                            {qdn.validation.validated_at
                                ? new Date(
                                      qdn.validation.validated_at,
                                  ).toLocaleString()
                                : "—"}
                        </dd>
                        <dt>Remarks</dt>
                        <dd>{qdn.validation.remarks || "—"}</dd>
                    </dl>
                </section>
            )}

            {qdn.rca_causes?.length > 0 && (
                <section className="qdn-readonly-summary">
                    <h2>Root Cause Analysis (RCA)</h2>
                    <dl>
                        <dt>Submitted By</dt>
                        <dd>{qdn.rca_submitted_by ?? "—"}</dd>
                        <dt>Submitted At</dt>
                        <dd>
                            {qdn.rca_submitted_at
                                ? new Date(
                                      qdn.rca_submitted_at,
                                  ).toLocaleString()
                                : "—"}
                        </dd>
                        <dt>PE Validated By</dt>
                        <dd>{qdn.rca_validated_by ?? "—"}</dd>
                        <dt>PE Validated At</dt>
                        <dd>
                            {qdn.rca_validated_at
                                ? new Date(
                                      qdn.rca_validated_at,
                                  ).toLocaleString()
                                : "—"}
                        </dd>
                        <dt>PE Remarks</dt>
                        <dd>{qdn.rca_validation_remarks || "—"}</dd>
                    </dl>

                    <Timeline>
                        <TimelineItem
                            icon={AlertTriangle}
                            title="Root Cause of Event"
                        >
                            <RcaCauseTable rows={qdn.rca_causes} type="event" />
                        </TimelineItem>
                        <TimelineItem
                            icon={ArrowUpRight}
                            title="Root Cause of Escape"
                        >
                            <RcaCauseTable
                                rows={qdn.rca_causes}
                                type="escape"
                            />
                        </TimelineItem>
                        <TimelineItem icon={Settings} title="System Cause">
                            <RcaCauseTable
                                rows={qdn.rca_causes}
                                type="system"
                            />
                        </TimelineItem>
                    </Timeline>
                </section>
            )}

            {qdn.pe_disposition && (
                <section className="qdn-readonly-summary">
                    <h2>
                        <Stamp
                            size={18}
                            style={{
                                verticalAlign: "text-bottom",
                                marginRight: 6,
                            }}
                        />
                        PE Disposition
                    </h2>
                    <dl>
                        <dt>Disposition</dt>
                        <dd>
                            {DISPOSITION_LABELS[qdn.pe_disposition] ??
                                qdn.pe_disposition}
                        </dd>
                        <dt>Remarks</dt>
                        <dd>{qdn.pe_disposition_remarks || "—"}</dd>
                        <dt>By</dt>
                        <dd>{qdn.pe_disposition_by ?? "—"}</dd>
                        <dt>At</dt>
                        <dd>
                            {qdn.pe_disposition_at
                                ? new Date(
                                      qdn.pe_disposition_at,
                                  ).toLocaleString()
                                : "—"}
                        </dd>
                    </dl>
                </section>
            )}

            {(qdn.capa_containment_lots?.length > 0 ||
                qdn.capa_corrections?.length > 0 ||
                qdn.capa_corrective_what) && (
                <section className="qdn-readonly-summary">
                    <h2>Corrective &amp; Preventive Action (CAPA)</h2>
                    <dl>
                        <dt>Current Round</dt>
                        <dd>{qdn.capa_round ?? 1}</dd>
                        <dt>Submitted By</dt>
                        <dd>{qdn.capa_submitted_by ?? "—"}</dd>
                        <dt>Submitted At</dt>
                        <dd>
                            {qdn.capa_submitted_at
                                ? new Date(
                                      qdn.capa_submitted_at,
                                  ).toLocaleString()
                                : "—"}
                        </dd>
                    </dl>

                    {/* Every round ever submitted, newest first, plus the
                        return/rejection note for any round that was sent
                        back. Rows are never deleted on resubmission (see
                        QdnWorkflowController@capaStore), so this is the
                        full CAPA back-and-forth history, not just the
                        current round. */}
                    <CapaRoundHistory
                        containmentLots={qdn.capa_containment_lots ?? []}
                        corrections={qdn.capa_corrections ?? []}
                        returns={qdn.capa_returns ?? []}
                    />

                    <Timeline>
                        <TimelineItem
                            icon={CheckSquare}
                            title="Corrective Action (current)"
                        >
                            <dl>
                                <dt>What</dt>
                                <dd>{qdn.capa_corrective_what || "—"}</dd>
                                <dt>Responsible</dt>
                                <dd>
                                    {qdn.capa_corrective_responsible_name ??
                                        "—"}
                                </dd>
                                <dt>When</dt>
                                <dd>
                                    {qdn.capa_corrective_when
                                        ? new Date(
                                              qdn.capa_corrective_when,
                                          ).toLocaleDateString()
                                        : "—"}
                                </dd>
                                <dt>Status</dt>
                                <dd>{qdn.capa_corrective_status ?? "—"}</dd>
                            </dl>
                        </TimelineItem>
                    </Timeline>
                </section>
            )}

            {qdn.capa_approval_status && (
                <section className="qdn-readonly-summary">
                    <h2>
                        <Stamp
                            size={18}
                            style={{
                                verticalAlign: "text-bottom",
                                marginRight: 6,
                            }}
                        />
                        Dept Approval
                    </h2>
                    <dl>
                        <dt>Decision</dt>
                        <dd>
                            {qdn.capa_approval_status === "correct"
                                ? "Correct"
                                : "Wrong (returned for update)"}
                        </dd>
                        <dt>By</dt>
                        <dd>{qdn.capa_approved_by ?? "—"}</dd>
                        <dt>At</dt>
                        <dd>
                            {qdn.capa_approved_at
                                ? new Date(
                                      qdn.capa_approved_at,
                                  ).toLocaleString()
                                : "—"}
                        </dd>
                        <dt>Remarks</dt>
                        <dd>{qdn.capa_approval_remarks || "—"}</dd>
                    </dl>
                </section>
            )}

            {qdn.qa_capa_implemented && (
                <section className="qdn-readonly-summary">
                    <h2>QA Verification</h2>
                    <dl>
                        <dt>Corrective Action Implemented?</dt>
                        <dd>
                            {qdn.qa_capa_implemented === "yes"
                                ? "Yes"
                                : "No (returned for CAPA rework)"}
                        </dd>
                        <dt>Verification of Effectiveness / Remarks</dt>
                        <dd>{qdn.qa_verification_remarks || "—"}</dd>
                        <dt>By</dt>
                        <dd>{qdn.qa_verified_by ?? "—"}</dd>
                        <dt>At</dt>
                        <dd>
                            {qdn.qa_verified_at
                                ? new Date(qdn.qa_verified_at).toLocaleString()
                                : "—"}
                        </dd>
                    </dl>
                </section>
            )}
        </>
    );
}

/**
 * Every CAPA round ever submitted for this QDN, newest first, each with
 * its Containment/Correction rows plus the return note (who sent it back
 * and why) if that round was rejected. containmentLots/corrections/
 * returns all carry a `round` number -- see QdnWorkflowController@capaStore/
 * approvalStore/qaStore and the 2026_08_25_000002 migration.
 */
function CapaRoundHistory({ containmentLots, corrections, returns }) {
    const rounds = Array.from(
        new Set([
            ...containmentLots.map((l) => l.round ?? 1),
            ...corrections.map((c) => c.round ?? 1),
        ]),
    ).sort((a, b) => b - a);

    if (rounds.length === 0) {
        return null;
    }

    return (
        <div className="qdn-capa-history">
            {rounds.map((round) => {
                const roundReturns = returns.filter((r) => r.round === round);
                const roundContainment = containmentLots.filter(
                    (l) => (l.round ?? 1) === round,
                );
                const roundCorrections = corrections.filter(
                    (c) => (c.round ?? 1) === round,
                );

                return (
                    <div className="qdn-capa-round" key={round}>
                        <h3>Round {round}</h3>

                        {roundContainment.length > 0 && (
                            <>
                                <h4>Containment Action</h4>
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
                                            <th>Result of Inspection</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {roundContainment.map((lot) => (
                                            <tr key={lot.id}>
                                                <td>
                                                    {lot.date_processed
                                                        ? new Date(
                                                              lot.date_processed,
                                                          ).toLocaleString()
                                                        : "—"}
                                                </td>
                                                <td>{lot.lot_id}</td>
                                                <td>{lot.part_name}</td>
                                                <td>{lot.qty}</td>
                                                <td>
                                                    {lot.inspected_by_name ??
                                                        lot.inspected_by_employee_id}
                                                </td>
                                                <td>{lot.status}</td>
                                                <td
                                                    dangerouslySetInnerHTML={{
                                                        __html:
                                                            lot.remarks || "",
                                                    }}
                                                />
                                                <td>
                                                    {lot.result_of_inspection}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </>
                        )}

                        {roundCorrections.length > 0 && (
                            <>
                                <h4>Correction Action</h4>
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
                                        {roundCorrections.map((c) => (
                                            <tr key={c.id}>
                                                <td>{c.activity}</td>
                                                <td>{c.qty_in}</td>
                                                <td>{c.qty_out}</td>
                                                <td>
                                                    {c.operator_employee_name ??
                                                        c.operator_employee_id}
                                                </td>
                                                <td>
                                                    {c.supervisor_employee_name ??
                                                        c.supervisor_employee_id}
                                                </td>
                                                <td>{c.machine_num}</td>
                                                <td>
                                                    {c.work_date
                                                        ? new Date(
                                                              c.work_date,
                                                          ).toLocaleDateString()
                                                        : "—"}
                                                </td>
                                                <td
                                                    dangerouslySetInnerHTML={{
                                                        __html: c.remarks || "",
                                                    }}
                                                />
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </>
                        )}

                        {roundReturns.map((r) => (
                            <p
                                className="qdn-capa-return-note"
                                key={`${round}-${r.id}`}
                            >
                                <RotateCcw
                                    size={14}
                                    style={{
                                        verticalAlign: "text-bottom",
                                        marginRight: 4,
                                    }}
                                />
                                Returned by{" "}
                                <strong>{r.returned_by ?? "—"}</strong>
                                {r.stage === "qa"
                                    ? " (QA Verification)"
                                    : " (Dept Approval)"}
                                {r.returned_at
                                    ? ` on ${new Date(r.returned_at).toLocaleString()}`
                                    : ""}
                                {r.remarks ? `: "${r.remarks}"` : ""}
                            </p>
                        ))}
                    </div>
                );
            })}
        </div>
    );
}

function RcaCauseTable({ rows, type }) {
    const filtered = (rows ?? []).filter((r) => r.cause_type === type);

    return (
        <>
            {filtered.length === 0 ? (
                <p>None recorded.</p>
            ) : (
                <table className="qdn-table">
                    <thead>
                        <tr>
                            <th>Select Cause</th>
                            <th>Cause</th>
                            <th>Source of Defect</th>
                            <th>Responsible</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((r) => (
                            <tr key={r.id}>
                                <td>{r.reason_root_cause_name ?? "—"}</td>
                                <td>{r.cause ?? "—"}</td>
                                <td>{r.defect_source_name ?? "—"}</td>
                                <td>{r.responsible_employee_name ?? "—"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {/* "Issued To" list -- a JSON column on the row (issued_to),
                only ever non-empty on rows whose Source of Defect was
                "Man" (see App\Models\Defect::isMan() /
                QdnWorkflowController::syncRcaCauses()). */}
            {filtered
                .filter((r) => r.issued_to?.length > 0)
                .map((r) => (
                    <div key={`issued-to-${r.id}`} className="qdn-nested-table">
                        <h4>
                            Issued To — {r.defect_source_name ?? "Man"} (
                            {r.reason_root_cause_name ??
                                r.cause ??
                                `row ${r.id}`}
                            )
                        </h4>
                        <table className="qdn-table">
                            <thead>
                                <tr>
                                    <th>Emp No</th>
                                    <th>Name</th>
                                    <th>Department</th>
                                    <th>Station</th>
                                    <th>Productline</th>
                                </tr>
                            </thead>
                            <tbody>
                                {r.issued_to.map((e, i) => (
                                    <tr key={`${r.id}-${e.employee_id ?? i}`}>
                                        <td>{e.employee_id}</td>
                                        <td>{e.employee_name ?? "—"}</td>
                                        <td>{e.department ?? "—"}</td>
                                        <td>{e.station ?? "—"}</td>
                                        <td>{e.prodline ?? "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ))}
        </>
    );
}
