import { Head } from '@inertiajs/react';
import { FlaskConical } from 'lucide-react';
import QdnListTable from '@/Components/QdnListTable';
import BackLink from '@/Components/BackLink';

/**
 * Department's RCA queue -- QDNs with status for_dept_rca, routed here by
 * PE's initial valid decision. Props (from QdnWorkflowController@rcaIndex):
 * department, qdns
 */
export default function RcaIndex({ department, qdns }) {
    return (
        <div className="qdn-page">
            <Head title="For Dept RCA" />
            <BackLink href="/qdn/dashboard" label="Back to QDN Dashboard" />
            <h1>For Dept RCA — {department ?? '—'}</h1>

            {/* dateLabel is "QDN Submitted", not "date assigned to this stage" --
                the list query only carries created_at to keep it lean; full
                stage timestamps (rca_submitted_at, etc.) are on the Show page. */}
            <QdnListTable
                qdns={qdns}
                dateLabel="QDN Submitted"
                actionLabel="Update RCA"
                actionIcon={FlaskConical}
                actionHref={(q) => `/qdn/rca/${q.id}`}
                emptyLabel="No QDNs currently awaiting RCA."
            />
        </div>
    );
}
