import { useState } from "react";
import { Head, router } from "@inertiajs/react";
import { CheckCircle2, XCircle } from "lucide-react";
import QdnDetailCard from "@/Components/QdnDetailCard";
import BackLink from "@/Components/BackLink";

/**
 * Dept Approval of CAPA -- the issuing department reviews its own CAPA
 * submission and marks it Correct or Wrong:
 *   Correct -- routes the QDN to Department: QA for verification.
 *   Wrong -- returns it to the issuing department to update CAPA;
 *     remarks are required so they know what to fix. Logged
 *     (QdnCapaReturn, stage=approval) and bumps qdn.capa_round so the
 *     next CAPA submission lands as a new round instead of overwriting
 *     this one -- see QdnDetailCard's CAPA history section for the full
 *     back-and-forth across rounds.
 *
 * "Correct" does not close the QDN by itself -- it still goes through QA
 * Verification, same as the existing for_dept_approval -> for_qa_
 * verification pipeline; QA Verification is what actually closes it.
 *
 * Checkboxes used as a mutually-exclusive single-select (not true
 * multi-select) -- same established pattern as Validate.jsx / PeRca/Show.jsx.
 * Posts { decision, remarks } directly via router.post rather than
 * through useForm, same stale-closure-avoidance reasoning as those pages.
 *
 * `canApprove` is false for anyone below Section Head/Manager (plain
 * Supervisor included) -- the whole department can still see this queue
 * and open a QDN's approval page, but only Section Head/Manager can
 * actually submit the Correct/Wrong decision (see
 * QdnWorkflowController@assertIsApprover).
 *
 * Props (from QdnWorkflowController@approvalShow): qdn, canApprove
 */
export default function ApprovalShow({ qdn, canApprove }) {
    const [decision, setDecision] = useState(null);
    const [remarks, setRemarks] = useState("");
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState(null);

    function handleSubmit(e) {
        e.preventDefault();
        if (!canApprove) {
            setError("Only Section Head or Manager can submit this decision.");
            return;
        }
        if (!decision) {
            setError("Select Correct or Wrong.");
            return;
        }
        if (decision === "wrong" && !remarks.trim()) {
            setError("Remarks are required when marking a CAPA Wrong.");
            return;
        }
        setProcessing(true);
        setError(null);
        router.post(
            `/qdn/approval/${qdn.id}`,
            { decision, remarks },
            {
                onError: (errors) =>
                    setError(
                        errors.decision ||
                            errors.remarks ||
                            "Something went wrong.",
                    ),
                onFinish: () => setProcessing(false),
            },
        );
    }

    return (
        <div className="qdn-page">
            <Head title={`Dept Approval — ${qdn.qdn_no}`} />
            <BackLink
                href="/qdn/approval"
                label="Back to Dept Approval queue"
            />
            <h1>Dept Approval of CAPA — {qdn.qdn_no}</h1>

            <QdnDetailCard qdn={qdn} />

            <form onSubmit={handleSubmit} className="qdn-dashboard-section">
                <h2>Approval</h2>

                {!canApprove && (
                    <p className="qdn-restricted-notice">
                        Only Section Head or Manager can approve CAPA. You can
                        view this QDN, but submitting a decision requires
                        someone at that level to sign in.
                    </p>
                )}

                <div className="qdn-decision-row">
                    <button
                        type="button"
                        className={`qdn-decision-btn qdn-decision-correct${decision === "correct" ? " is-selected" : ""}`}
                        disabled={!canApprove}
                        aria-pressed={decision === "correct"}
                        onClick={() => setDecision("correct")}
                    >
                        <CheckCircle2 size={18} />
                        Approve
                    </button>
                    <button
                        type="button"
                        className={`qdn-decision-btn qdn-decision-wrong${decision === "wrong" ? " is-selected" : ""}`}
                        disabled={!canApprove}
                        aria-pressed={decision === "wrong"}
                        onClick={() => setDecision("wrong")}
                    >
                        <XCircle size={18} />
                        Disapprove
                    </button>
                </div>

                <p className="qdn-hint">
                    Correct routes this QDN to Department: QA for verification.
                    Wrong returns it to{" "}
                    {qdn.issued_department ?? "the issuing department"} to
                    update CAPA — remarks are required so they know what to fix.
                </p>

                <div className="qdn-field qdn-field-wide">
                    <label htmlFor="remarks">
                        Remarks{" "}
                        {decision === "wrong" ? "(required)" : "(optional)"}
                    </label>
                    <textarea
                        id="remarks"
                        rows={4}
                        value={remarks}
                        disabled={!canApprove}
                        onChange={(e) => setRemarks(e.target.value)}
                    />
                </div>

                {error && <p className="qdn-field-error">{error}</p>}

                <button
                    type="submit"
                    className="qdn-btn"
                    disabled={processing || !canApprove}
                >
                    Submit
                </button>
            </form>
        </div>
    );
}
