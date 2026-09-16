import { Head, Link } from '@inertiajs/react';
import { Eye } from 'lucide-react';
import BackLink from '@/Components/BackLink';

/**
 * A department's own queue of QDNs issued to it by PE.
 * Props (from IssuedQdnController@index): department, qdns
 */
export default function IssuedIndex({ department, qdns }) {
    return (
        <div className="qdn-page">
            <Head title={`QDNs Issued to ${department ?? 'your department'}`} />
            <BackLink href="/qdn/dashboard" label="Back to QDN Dashboard" />
            <h1>QDNs Issued to {department ?? '—'}</h1>

            <table className="qdn-table">
                <thead>
                    <tr>
                        <th>QDN No</th>
                        <th>Customer</th>
                        <th>Device</th>
                        <th>Classification</th>
                        <th>Status</th>
                        <th>Issued</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {qdns.length === 0 && (
                        <tr>
                            <td colSpan={7}>No QDNs currently issued to your department.</td>
                        </tr>
                    )}
                    {qdns.map((q) => (
                        <tr key={q.id}>
                            <td>{q.qdn_no}</td>
                            <td>{q.customer_name}</td>
                            <td>{q.device_name}</td>
                            <td>{q.classification}</td>
                            <td>{q.status_label}</td>
                            <td>{new Date(q.created_at).toLocaleString()}</td>
                            <td>
                                <Link href={`/department/qdn/${q.id}`} className="qdn-icon-link" title="View" aria-label="View">
                                    <Eye size={16} />
                                </Link>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
