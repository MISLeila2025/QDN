import { Head } from '@inertiajs/react';
import { BadgeCheck } from 'lucide-react';
import QdnListTable from '@/Components/QdnListTable';
import BackLink from '@/Components/BackLink';

/**
 * QA's verification queue -- QDNs with status for_qa_verification, visible
 * to anyone whose session emp_data.emp_dept is "QA" (same pattern as
 * Department: PE). Props (from QdnWorkflowController@qaIndex): qdns
 */
export default function QaVerificationIndex({ qdns }) {
    return (
        <div className="qdn-page">
            <Head title="For QA Verification" />
            <BackLink href="/qdn/dashboard" label="Back to QDN Dashboard" />
            <h1>For QA Verification</h1>

            <QdnListTable
                qdns={qdns}
                dateLabel="QDN Submitted"
                actionLabel="Verify"
                actionIcon={BadgeCheck}
                actionHref={(q) => `/qa/verification/${q.id}`}
                emptyLabel="No QDNs currently awaiting QA verification."
            />
        </div>
    );
}
