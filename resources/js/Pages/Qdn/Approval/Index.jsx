import { Head } from '@inertiajs/react';
import { Stamp } from 'lucide-react';
import QdnListTable from '@/Components/QdnListTable';
import BackLink from '@/Components/BackLink';

/**
 * Department's approval queue -- QDNs with status for_dept_approval,
 * routed here once the department submits a CAPA. Props (from
 * QdnWorkflowController@approvalIndex): department, qdns
 */
export default function ApprovalIndex({ department, qdns }) {
    return (
        <div className="qdn-page">
            <Head title="For Dept Approval" />
            <BackLink href="/qdn/dashboard" label="Back to QDN Dashboard" />
            <h1>For Dept Approval — {department ?? '—'}</h1>

            <QdnListTable
                qdns={qdns}
                dateLabel="QDN Submitted"
                actionLabel="Approve"
                actionIcon={Stamp}
                actionHref={(q) => `/qdn/approval/${q.id}`}
                emptyLabel="No QDNs currently awaiting department approval."
            />
        </div>
    );
}
