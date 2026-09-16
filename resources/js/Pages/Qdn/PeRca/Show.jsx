import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import QdnDetailCard from '@/Components/QdnDetailCard';
import BackLink from '@/Components/BackLink';

// Mirrors App\Models\Qdn::DISPOSITIONS / DISPOSITION_LABELS.
const DISPOSITIONS = [
    { value: 'rework', label: 'Rework' },
    { value: 'split_lot', label: 'Split Lot' },
    { value: 'shutdown', label: 'Shutdown' },
    { value: 'shipback', label: 'Shipback' },
    { value: 'use_as_is', label: 'Use As Is' },
    { value: 'invalid', label: 'Invalid' },
];

/**
 * PE Disposition -- PE reviews a department's RCA submission and picks
 * exactly one outcome. Rework / Split Lot / Shutdown / Shipback / Use As
 * Is all route the QDN back to its issued department for CAPA; Invalid
 * closes the QDN instead (status -> invalid_disposition) -- it still
 * stays in QDN Records / the department's history, just doesn't continue
 * to CAPA.
 *
 * Posts { disposition, remarks } directly via router.post rather than
 * through useForm -- same reasoning as QdnDecisionForm: useForm's
 * setData() is batched/async, so calling it then post() in the same click
 * handler can send the PREVIOUS value instead of the one just clicked.
 *
 * Props (from QdnWorkflowController@peRcaShow): qdn
 */
export default function PeRcaShow({ qdn }) {
    const [disposition, setDisposition] = useState(null);
    const [remarks, setRemarks] = useState('');
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState(null);

    function handleSubmit(e) {
        e.preventDefault();
        if (!disposition) {
            setError('Select a disposition.');
            return;
        }
        setProcessing(true);
        setError(null);
        router.post(
            `/pe/rca/${qdn.id}`,
            { disposition, remarks },
            {
                onError: (errors) => setError(errors.disposition || errors.remarks || 'Something went wrong.'),
                onFinish: () => setProcessing(false),
            }
        );
    }

    return (
        <div className="qdn-page">
            <Head title={`PE Disposition — ${qdn.qdn_no}`} />
            <BackLink href="/pe/rca" label="Back to PE: RCA Validation queue" />
            <h1>PE Disposition — {qdn.qdn_no}</h1>

            <QdnDetailCard qdn={qdn} />

            <form onSubmit={handleSubmit} className="qdn-dashboard-section">
                <h2>Disposition</h2>

                <div className="qdn-checkbox-row qdn-checkbox-row-wrap">
                    {DISPOSITIONS.map((d) => (
                        <label key={d.value} className="qdn-checkbox">
                            <input
                                type="checkbox"
                                checked={disposition === d.value}
                                onChange={() => setDisposition(d.value)}
                            />
                            {d.label}
                        </label>
                    ))}
                </div>

                <p className="qdn-hint">
                    Rework, Split Lot, Shutdown, Shipback, and Use As Is all route this QDN back to{' '}
                    {qdn.issued_department ?? 'the issuing department'} for CAPA. Invalid closes the QDN here --
                    it stays in QDN Records with status "Invalid Disposition."
                </p>

                <div className="qdn-field qdn-field-wide">
                    <label htmlFor="remarks">Remarks</label>
                    <textarea id="remarks" rows={4} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                </div>

                {error && <p className="qdn-field-error">{error}</p>}

                <button type="submit" className="qdn-btn" disabled={processing}>
                    Submit
                </button>
            </form>
        </div>
    );
}
