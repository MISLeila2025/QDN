import { Head, Link } from '@inertiajs/react';
import BackLink from '@/Components/BackLink';

/**
 * PE's validation queue -- QDNs with status pending_pe.
 * Props (from PeValidationController@index): qdns
 */
export default function Index({ qdns }) {
    return (
        <div className="qdn-page">
            <Head title="QDN Validation Queue — PE" />
            <BackLink href="/qdn/dashboard" label="Back to QDN Dashboard" />
            <h1>QDN Validation Queue (Department: PE)</h1>

            <table className="qdn-table">
                <thead>
                    <tr>
                        <th>QDN No</th>
                        <th>Customer</th>
                        <th>Device</th>
                        <th>Classification</th>
                        <th>Submitted</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {qdns.length === 0 && (
                        <tr>
                            <td colSpan={6}>No QDNs pending validation.</td>
                        </tr>
                    )}
                    {qdns.map((q) => (
                        <tr key={q.id}>
                            <td>{q.qdn_no}</td>
                            <td>{q.customer_name}</td>
                            <td>{q.device_name}</td>
                            <td>{q.classification}</td>
                            <td>{new Date(q.created_at).toLocaleString()}</td>
                            <td>
                                <Link href={`/pe/qdn/${q.id}`}>Validate</Link>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
