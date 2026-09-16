import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import QdnDetailCard from '@/Components/QdnDetailCard';
import BackLink from '@/Components/BackLink';

/**
 * QA Verification -- QA confirms whether the department's CAPA was
 * actually implemented:
 *   Yes -- records "Verification of Effectiveness" and closes the QDN.
 *   No -- returns it to the issuing department for CAPA rework. Logged
 *     (QdnCapaReturn, stage=qa) and bumps qdn.capa_round, same history
 *     mechanism as Dept Approval's "Wrong" -- see QdnDetailCard's CAPA
 *     history section.
 *
 * True radio buttons here (per spec: "radio Yes radio No"), unlike the
 * checkbox-as-select pattern used elsewhere in this workflow -- this is a
 * genuinely binary choice.
 *
 * Posts { capa_implemented, notes } directly via router.post, same
 * stale-closure-avoidance reasoning as PeRca/Show.jsx / Approval/Show.jsx.
 *
 * Props (from QdnWorkflowController@qaShow): qdn
 */
export default function QaVerificationShow({ qdn }) {
    const [implemented, setImplemented] = useState(null);
    const [notes, setNotes] = useState('');
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState(null);

    function handleSubmit(e) {
        e.preventDefault();
        if (!implemented) {
            setError('Select Yes or No.');
            return;
        }
        if (implemented === 'yes' && !notes.trim()) {
            setError('Verification of Effectiveness is required.');
            return;
        }
        setProcessing(true);
        setError(null);
        router.post(
            `/qa/verification/${qdn.id}`,
            { capa_implemented: implemented, notes },
            {
                onError: (errors) => setError(errors.capa_implemented || errors.notes || 'Something went wrong.'),
                onFinish: () => setProcessing(false),
            }
        );
    }

    return (
        <div className="qdn-page">
            <Head title={`QA Verification — ${qdn.qdn_no}`} />
            <BackLink href="/qa/verification" label="Back to QA Verification queue" />
            <h1>QA Verification — {qdn.qdn_no}</h1>

            <QdnDetailCard qdn={qdn} />

            <form onSubmit={handleSubmit} className="qdn-dashboard-section">
                <h2>Verification</h2>

                <div className="qdn-field">
                    <label>Corrective Action implemented?</label>
                    <div className="qdn-radio-row">
                        <label className="qdn-radio">
                            <input
                                type="radio"
                                name="capa_implemented"
                                checked={implemented === 'yes'}
                                onChange={() => setImplemented('yes')}
                            />
                            Yes
                        </label>
                        <label className="qdn-radio">
                            <input
                                type="radio"
                                name="capa_implemented"
                                checked={implemented === 'no'}
                                onChange={() => setImplemented('no')}
                            />
                            No
                        </label>
                    </div>
                </div>

                <p className="qdn-hint">
                    Yes records Verification of Effectiveness and closes this QDN. No returns it to{' '}
                    {qdn.issued_department ?? 'the issuing department'} for CAPA rework.
                </p>

                <div className="qdn-field qdn-field-wide">
                    <label htmlFor="notes">
                        {implemented === 'no' ? 'Remarks (optional)' : 'Verification of Effectiveness'}
                    </label>
                    <textarea id="notes" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>

                {error && <p className="qdn-field-error">{error}</p>}

                <button type="submit" className="qdn-btn" disabled={processing}>
                    Submit
                </button>
            </form>
        </div>
    );
}
