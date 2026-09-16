import { Head } from '@inertiajs/react';
import QdnDetailCard from '@/Components/QdnDetailCard';
import BackLink from '@/Components/BackLink';

/**
 * Read-only detail view for a QDN issued to the current user's department --
 * shows every field recorded so far, whichever workflow stage it's
 * currently sitting in (RCA / CAPA / Dept Approval / QA Verification).
 * Props (from IssuedQdnController@show): qdn
 */
export default function IssuedShow({ qdn }) {
    return (
        <div className="qdn-page">
            <Head title={`QDN ${qdn.qdn_no}`} />
            <BackLink href="/department/qdn" label="Back to QDNs for My Department" />
            <h1>QDN {qdn.qdn_no}</h1>

            <QdnDetailCard qdn={qdn} />
        </div>
    );
}
