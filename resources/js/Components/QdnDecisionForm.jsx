import { useState } from 'react';
import { router } from '@inertiajs/react';

/**
 * Shared approve/reject action bar for every "someone reviews and decides"
 * stage of the workflow: PE Validation of RCA, Dept Approval of CAPA, and
 * QA Verification. Posts { decision, remarks } directly via router.post
 * rather than through useForm -- useForm's setData() is batched/async, so
 * calling setData() then post() in the same click handler can send the
 * PREVIOUS decision value instead of the one just clicked. Building the
 * payload inline and posting it directly avoids that.
 */
export default function QdnDecisionForm({
    postUrl,
    approveValue = 'approve',
    approveLabel,
    rejectValue = 'reject',
    rejectLabel,
    remarksLabel = 'Remarks',
}) {
    const [remarks, setRemarks] = useState('');
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState(null);

    function decide(decision) {
        setProcessing(true);
        setError(null);
        router.post(
            postUrl,
            { decision, remarks },
            {
                onError: (errors) => setError(errors.decision || errors.remarks || 'Something went wrong.'),
                onFinish: () => setProcessing(false),
            }
        );
    }

    return (
        <div className="qdn-field qdn-field-wide">
            <label htmlFor="remarks">{remarksLabel}</label>
            <textarea id="remarks" rows={4} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            {error && <p className="qdn-field-error">{error}</p>}
            <div className="qdn-actions">
                <button type="button" disabled={processing} onClick={() => decide(approveValue)}>
                    {approveLabel}
                </button>
                <button
                    type="button"
                    disabled={processing}
                    onClick={() => decide(rejectValue)}
                    className="qdn-btn-secondary"
                >
                    {rejectLabel}
                </button>
            </div>
        </div>
    );
}
