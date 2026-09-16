import { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { Search } from 'lucide-react';
import BackLink from '@/Components/BackLink';
import TelfordTabs from '@/Components/TelfordTabs';

// A cell shows the actual fetched value (per the QDN_Compliance_Record.xlsx
// column mapping -- QdnController::complianceIndex()'s doc comment has the
// full field list per element) with a left border colored by whether it's
// present, instead of a generic Yes/No badge with nothing behind it.
function DetailCell({ status, value }) {
    return (
        <span className={`qdn-compliance-detail qdn-compliance-detail-${status}`} title={value ?? ''}>
            {value ?? 'Not recorded'}
        </span>
    );
}

/**
 * Per-QDN TELFORD compliance drill-down -- the Dashboard's Compliance
 * rollup deliberately only shows aggregate percentages (see
 * QdnController::buildComplianceRollup()'s doc comment on why: no
 * per-row PHP loop, no "which QDNs" detail at 100k+ scale). This page is
 * that detail, done properly: paginated 25/page, with each element's
 * real underlying value (not just a yes/no) computed only for the
 * current page's rows (QdnController::complianceIndex()).
 *
 * Props (from QdnController@complianceIndex): qdns (paginator of
 * {id, qdn_no, status_label, elements, details, completion_percent}),
 * elementLabels ({key: label} -- now 11 of the 12 TELFORD elements;
 * only #9 Preventive Action has no backing field), filters ({q})
 */
export default function ComplianceIndex({ qdns, elementLabels = {}, filters = {} }) {
    const [q, setQ] = useState(filters.q ?? '');

    function handleSubmit(e) {
        e.preventDefault();
        router.get('/qdn/compliance', q ? { q } : {}, { preserveState: true, preserveScroll: true, replace: true });
    }

    const elementKeys = Object.keys(elementLabels);

    return (
        <div className="qdn-page" style={{ maxWidth: 1400 }}>
            <Head title="Compliance Detail" />
            <BackLink href="/qdn/dashboard" label="Back to QDN Dashboard" />
            <h1>QDN Compliance Detail (TELFORD Standard)</h1>
            <TelfordTabs active="/qdn/compliance" />
            <p className="qdn-hint">
                Per-QDN drill-down behind the Dashboard's Compliance Scorecard rollup, showing the actual data
                behind each element. Preventive Action always reads N/A -- no field exists for it yet.
            </p>

            <form onSubmit={handleSubmit} className="qdn-records-filters" style={{ gridTemplateColumns: '1fr auto' }}>
                <div className="qdn-field">
                    <label htmlFor="q">Search QDN No</label>
                    <div className="qdn-emp-search-input-wrap">
                        <Search size={14} className="qdn-emp-search-icon" />
                        <input id="q" type="text" placeholder="2026-0000001" value={q} onChange={(e) => setQ(e.target.value)} />
                    </div>
                </div>
                <div className="qdn-field">
                    <label>&nbsp;</label>
                    <button type="submit" className="qdn-btn">
                        Search
                    </button>
                </div>
            </form>

            <div className="qdn-table-scroll">
                <table className="qdn-table">
                    <thead>
                        <tr>
                            <th>QDN No</th>
                            <th>Status</th>
                            {elementKeys.map((key) => (
                                <th key={key}>{elementLabels[key]}</th>
                            ))}
                            <th>9. Preventive Action</th>
                            <th>Completion</th>
                        </tr>
                    </thead>
                    <tbody>
                        {qdns.data.length === 0 && (
                            <tr>
                                <td colSpan={elementKeys.length + 4}>No QDNs match this search.</td>
                            </tr>
                        )}
                        {qdns.data.map((row) => (
                            <tr key={row.id}>
                                <td>{row.qdn_no}</td>
                                <td>{row.status_label}</td>
                                {elementKeys.map((key) => (
                                    <td key={key}>
                                        <DetailCell status={row.elements[key]} value={row.details[key]} />
                                    </td>
                                ))}
                                <td>
                                    <span className="qdn-compliance-badge qdn-compliance-badge-na">N/A — not captured</span>
                                </td>
                                <td>{row.completion_percent}%</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Pagination paginator={qdns} />
        </div>
    );
}

function Pagination({ paginator }) {
    if (paginator.last_page <= 1) {
        return null;
    }

    return (
        <div className="qdn-pagination">
            <span className="qdn-pagination-summary">
                Showing {paginator.from ?? 0}–{paginator.to ?? 0} of {paginator.total}
            </span>
            <div className="qdn-pagination-links">
                {paginator.links.map((link, i) => (
                    <PaginationLink key={i} link={link} />
                ))}
            </div>
        </div>
    );
}

function PaginationLink({ link }) {
    if (!link.url) {
        return <span className="qdn-pagination-link is-disabled" dangerouslySetInnerHTML={{ __html: link.label }} />;
    }

    return (
        <Link
            href={link.url}
            preserveState
            preserveScroll
            className={`qdn-pagination-link${link.active ? ' is-active' : ''}`}
            dangerouslySetInnerHTML={{ __html: link.label }}
        />
    );
}
