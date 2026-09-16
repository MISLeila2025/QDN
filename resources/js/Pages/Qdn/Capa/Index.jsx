import { Head } from '@inertiajs/react';
import { Wrench } from 'lucide-react';
import QdnListTable from '@/Components/QdnListTable';
import BackLink from '@/Components/BackLink';

/**
 * Department's CAPA queue -- QDNs with status for_dept_capa, routed here
 * once PE approves the RCA. Props (from QdnWorkflowController@capaIndex):
 * department, qdns
 */
export default function CapaIndex({ department, qdns }) {
    return (
        <div className="qdn-page">
            <Head title="For Department CAPA" />
            <BackLink href="/qdn/dashboard" label="Back to QDN Dashboard" />
            <h1>For Department CAPA — {department ?? '—'}</h1>

            <QdnListTable
                qdns={qdns}
                dateLabel="QDN Submitted"
                actionLabel="Update CAPA"
                actionIcon={Wrench}
                actionHref={(q) => `/qdn/capa/${q.id}`}
                emptyLabel="No QDNs currently awaiting CAPA."
            />
        </div>
    );
}
