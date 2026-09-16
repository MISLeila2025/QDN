import { Head } from '@inertiajs/react';
import { ShieldCheck } from 'lucide-react';
import QdnListTable from '@/Components/QdnListTable';
import BackLink from '@/Components/BackLink';

/**
 * PE's RCA validation queue -- QDNs with status for_pe_rca_validation.
 * Props (from QdnWorkflowController@peRcaIndex): qdns
 */
export default function PeRcaIndex({ qdns }) {
    return (
        <div className="qdn-page">
            <Head title="For PE Validation of RCA" />
            <BackLink href="/qdn/dashboard" label="Back to QDN Dashboard" />
            <h1>For PE Validation of RCA</h1>

            <QdnListTable
                qdns={qdns}
                dateLabel="QDN Submitted"
                actionLabel="Review"
                actionIcon={ShieldCheck}
                actionHref={(q) => `/pe/rca/${q.id}`}
                emptyLabel="No RCAs currently awaiting PE validation."
            />
        </div>
    );
}
