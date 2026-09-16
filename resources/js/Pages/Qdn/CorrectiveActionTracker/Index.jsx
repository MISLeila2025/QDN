import { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { Search } from 'lucide-react';
import BackLink from '@/Components/BackLink';
import TelfordTabs from '@/Components/TelfordTabs';

/**
 * Corrective Action Tracker -- mirrors the Excel tab of the same name.
 * One row per containment lot, correction, or corrective-action record
 * (QdnController@correctiveActionTracker unions the three source tables
 * and paginates the union directly, so this scales the same way Records
 * does regardless of table size).
 *
 * Props (from QdnController@correctiveActionTracker): actions (paginator
 * of raw rows: qdn_no, action_type, action_description,
 * root_cause_addressed, responsible_owner, target_date, status,
 * implementation_evidence, effectiveness_measure, verification_date,
 * qa_qms_result, created_at), filters ({q})
 */
export default function CorrectiveActionTrackerIndex({ actions, filters = {} }) {
    const [q, setQ] = useState(filters.q ?? '');

    function handleSubmit(e) {
        e.preventDefault();
        router.get('/qdn/corrective-action-tracker', q ? { q } : {}, { preserveState: true, preserveScroll: true, replace: true });
    }

    return (
        <div className="qdn-page" style={{ maxWidth: 1500 }}>
            <Head title="Corrective Action Tracker" />
            <BackLink href="/qdn/dashboard" label="Back to QDN Dashboard" />
            <h1>Corrective Action Tracker</h1>
            <TelfordTabs active="/qdn/corrective-action-tracker" />
            <p className="qdn-hint">
                Every containment action, correction, and corrective action recorded across all QDNs, newest first.
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
                            <th>Action Type</th>
                            <th>Action Description</th>
                            <th>Root Cause Addressed</th>
                            <th>Responsible Owner</th>
                            <th>Target Date</th>
                            <th>Status</th>
                            <th>Implementation Evidence</th>
                            <th>Effectiveness Measure</th>
                            <th>Verification Date</th>
                            <th>QA/QMS Result</th>
                        </tr>
                    </thead>
                    <tbody>
                        {actions.data.length === 0 && (
                            <tr>
                                <td colSpan={11}>No corrective/preventive actions recorded yet.</td>
                            </tr>
                        )}
                        {actions.data.map((row, i) => (
                            <tr key={`${row.qdn_no}-${row.action_type}-${i}`}>
                                <td>{row.qdn_no}</td>
                                <td>{row.action_type}</td>
                                <td>{row.action_description ?? '—'}</td>
                                <td>{row.root_cause_addressed ?? '—'}</td>
                                <td>{row.responsible_owner ?? '—'}</td>
                                <td>{row.target_date ? new Date(row.target_date).toLocaleDateString() : '—'}</td>
                                <td>{row.status ?? '—'}</td>
                                <td>{row.implementation_evidence ? <span dangerouslySetInnerHTML={{ __html: row.implementation_evidence }} /> : '—'}</td>
                                <td>{row.effectiveness_measure ?? '—'}</td>
                                <td>{row.verification_date ? new Date(row.verification_date).toLocaleString() : '—'}</td>
                                <td>{row.qa_qms_result ?? '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Pagination paginator={actions} />
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
