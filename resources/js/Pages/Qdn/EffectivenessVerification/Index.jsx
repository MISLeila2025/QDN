import { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { Search } from 'lucide-react';
import BackLink from '@/Components/BackLink';
import TelfordTabs from '@/Components/TelfordTabs';

/**
 * Effectiveness Verification -- mirrors the Excel tab of the same name.
 * One row per QDN that has reached (or passed) QA Verification. Baseline
 * Result / Target-Acceptance Criteria / Monitoring Period columns are
 * shown but always blank -- this schema has no fields for them yet (same
 * caveat as the earlier Excel report); shown anyway so the tracker's
 * shape matches the standard even where the data doesn't exist yet.
 *
 * Props (from QdnController@effectivenessVerification): rows (paginator
 * of {qdn_no, problem_kpi, post_action_result, result_met, verified_by,
 * verification_date, closure_recommendation}), filters ({q, result_met})
 */
export default function EffectivenessVerificationIndex({ rows, filters = {} }) {
    const [q, setQ] = useState(filters.q ?? '');
    const [resultMet, setResultMet] = useState(filters.result_met ?? '');

    function applyFilters(overrides = {}) {
        const payload = { q, result_met: resultMet, ...overrides };
        const params = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== '' && v != null));
        router.get('/qdn/effectiveness-verification', params, { preserveState: true, preserveScroll: true, replace: true });
    }

    function handleSubmit(e) {
        e.preventDefault();
        applyFilters();
    }

    return (
        <div className="qdn-page" style={{ maxWidth: 1500 }}>
            <Head title="Effectiveness Verification" />
            <BackLink href="/qdn/dashboard" label="Back to QDN Dashboard" />
            <h1>Effectiveness Verification</h1>
            <TelfordTabs active="/qdn/effectiveness-verification" />
            <p className="qdn-hint">
                Every QDN that has reached QA Verification, newest first. Baseline Result, Target/Acceptance Criteria,
                and Monitoring Period are shown per the standard's format but aren't captured by this app yet -- see
                the Dashboard's Compliance rollup for the full list of schema gaps.
            </p>

            <form onSubmit={handleSubmit} className="qdn-records-filters" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <div className="qdn-field">
                    <label htmlFor="q">Search QDN No</label>
                    <div className="qdn-emp-search-input-wrap">
                        <Search size={14} className="qdn-emp-search-icon" />
                        <input id="q" type="text" placeholder="2026-0000001" value={q} onChange={(e) => setQ(e.target.value)} />
                    </div>
                </div>
                <div className="qdn-field">
                    <label htmlFor="result_met">Result Met?</label>
                    <select id="result_met" value={resultMet} onChange={(e) => setResultMet(e.target.value)}>
                        <option value="">-- All --</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                    </select>
                </div>
                <div className="qdn-field">
                    <label>&nbsp;</label>
                    <button type="submit" className="qdn-btn">
                        Apply Filters
                    </button>
                </div>
            </form>

            <div className="qdn-table-scroll">
                <table className="qdn-table">
                    <thead>
                        <tr>
                            <th>QDN No</th>
                            <th>Problem / KPI</th>
                            <th>Baseline Result</th>
                            <th>Target / Acceptance Criteria</th>
                            <th>Monitoring Period</th>
                            <th>Post-Action Result</th>
                            <th>Result Met?</th>
                            <th>Verified By</th>
                            <th>Verification Date</th>
                            <th>Closure Recommendation</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.data.length === 0 && (
                            <tr>
                                <td colSpan={10}>No QDNs have reached QA Verification yet.</td>
                            </tr>
                        )}
                        {rows.data.map((row) => (
                            <tr key={row.id}>
                                <td>{row.qdn_no}</td>
                                <td>{row.problem_kpi ?? '—'}</td>
                                <td>—</td>
                                <td>—</td>
                                <td>—</td>
                                <td>{row.post_action_result ?? '—'}</td>
                                <td>{row.result_met === 'yes' ? 'Yes' : row.result_met === 'no' ? 'No' : '—'}</td>
                                <td>{row.verified_by ?? '—'}</td>
                                <td>{row.verification_date ? new Date(row.verification_date).toLocaleString() : '—'}</td>
                                <td>{row.closure_recommendation}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Pagination paginator={rows} />
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
