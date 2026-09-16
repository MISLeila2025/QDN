import { useEffect, useMemo, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, Search } from 'lucide-react';
import ParetoChart from '@/Components/ParetoChart';
import BackLink from '@/Components/BackLink';
import TelfordTabs from '@/Components/TelfordTabs';
import { ClassificationBadge, StatusBadge } from '@/Components/Badges';
import MultiSelectDropdown from '@/Components/MultiSelectDropdown';

// "QDNs Matching Filters" is capped at 500 rows server-side (see
// QdnController::dashboard()'s doc comment on why -- it's "what's behind
// the chart," not a browsing view), so searching/sorting/paginating it
// is cheap to do entirely client-side against the rows already on the
// page: no extra round trip, and 500 rows is nothing for a browser to
// filter/sort. QDN Records is still the place for a true server-side
// paginated/searchable browse of the whole table.
const DASHBOARD_TABLE_PAGE_SIZE = 25;

const DASHBOARD_TABLE_COLUMNS = [
    { field: 'qdn_no', label: 'QDN No' },
    { field: 'customer_name', label: 'Customer' },
    { field: 'device_name', label: 'Device' },
    { field: 'detection_area', label: 'Detection Area' },
    { field: 'nonconformity_name', label: 'Non-Conformity' },
    { field: 'classification', label: 'Classification' },
    { field: 'status_label', label: 'Status' },
    { field: 'issued_department', label: 'Issued Department' },
    { field: 'created_at', label: 'Submitted' },
];

// Sub-views inside the Compliance Scorecard section -- 5-Block Model /
// 10-Question Checklist / 12 Elements used to all render stacked on top
// of each other (a long scroll); toggled via tabs instead, same
// qdn-tab pattern as GROUP_BY_TABS above.
const COMPLIANCE_TABS = [
    { value: 'blocks', label: '5-Block Model' },
    { value: 'questions', label: '10-Question Checklist' },
    { value: 'elements', label: '12 Elements' },
];

// Which dimension the Pareto ranks by -- mirrors
// QdnController::DASHBOARD_GROUP_BY. Rendered as tabs (same pattern as
// Records' status toggle) rather than a <select> since switching it is
// the primary way you interact with this page, not an incidental filter.
const GROUP_BY_TABS = [
    { value: 'failure_mode', label: 'Failure Mode' },
    { value: 'detection_area', label: 'Detection Area' },
    { value: 'nonconformity', label: 'Non-Conformity' },
    { value: 'customer', label: 'Customer' },
];

// "WW34 · 2026 (Aug 18–24)" -- same helper as Records/Index.jsx, kept as
// its own copy here rather than a shared import (this codebase's existing
// pattern for small display-only helpers -- see QdnDetailCard's
// DISPOSITION_LABELS mirroring Qdn::DISPOSITION_LABELS).
function formatWorkWeekLabel(w) {
    const fmt = (v) => (v ? new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null);
    const start = fmt(w.date_start);
    const end = fmt(w.date_end);
    const range = start && end ? ` (${start}–${end})` : '';
    return `WW${w.workweek} · ${w.year}${range}`;
}

function toArray(v) {
    if (v === undefined || v === null || v === '') return [];
    return Array.isArray(v) ? v : [v];
}

/**
 * QDN Dashboard -- replaced the old "three lists" (Pending / In Progress /
 * Invalid) with a filterable Pareto analysis across the full QDN history.
 * Pick a dimension to rank (Failure Mode / Detection Area / Non-Conformity
 * / Customer), filter by date range or calendar Work Week plus any
 * combination of detection area / non-conformity / customer / failure
 * mode (each multi-select -- hold Ctrl/Cmd, or Shift for a range, to pick
 * more than one), and get a ranked Pareto chart, its count/percent/
 * cumulative-percent table, and the full list of QDNs behind those
 * numbers, all recomputed from the same filtered set.
 *
 * Every workflow queue (PE Validation, Dept RCA/CAPA/Approval, QA
 * Verification, "QDNs for My Department") has its own permanent sidebar
 * link -- see Navigation.jsx -- so removing the old personal/department
 * lists from this page doesn't strand anyone.
 *
 * Props (from QdnController@dashboard): groupBy, paretoData
 * ([{label, count}]), qdns (up to 500 most recent matches), compliance
 * (TELFORD-standard scorecard -- see below), totalCount, filters (current
 * query params), filterOptions (detectionAreas, nonconformities,
 * customers, failureModes, workWeeks)
 *
 * `compliance` = { count, elementRates: [{key, label, percent}],
 * blockRollup: [{block, focus, percent}] (5-Block Model), questionRollup:
 * [{no, question, percent, note}] (10-Question Checklist), averageCompletion
 * } -- pure SQL aggregates against the same filtered set as the Pareto/
 * table above, computed in QdnController::buildComplianceRollup(). Scales
 * to 100k+ QDNs by design: no per-row PHP loop, no per-QDN detail here at
 * all -- that detail lives on its own paginated page (/qdn/compliance),
 * linked from this section. 11 of the TELFORD standard's 12 elements are
 * scored; only Preventive Action has no backing field anywhere in this
 * schema, so Block 4 and Question 9 above only average the elements that
 * do exist, called out via `note`.
 */
export default function Dashboard({
    groupBy,
    paretoData = [],
    qdns = [],
    compliance,
    totalCount = 0,
    filters = {},
    filterOptions = {},
}) {
    // Defensive defaults -- if this component ever mounts before Inertia
    // hands it a `filters`/`filterOptions` prop (e.g. hitting this page
    // via a route that isn't actually QdnController@dashboard, a stale
    // cached route list, or a partial reload that dropped a key), destructuring
    // filters.date_from etc. below would throw "Cannot read properties of
    // undefined" and blank the whole page instead of just degrading.
    const safeFilterOptions = {
        detectionAreas: [],
        nonconformities: [],
        customers: [],
        failureModes: [],
        workWeeks: [],
        ...filterOptions,
    };
    const safeCompliance = {
        count: 0,
        elementRates: [],
        blockRollup: [],
        questionRollup: [],
        averageCompletion: 0,
        ...compliance,
    };

    const [complianceTab, setComplianceTab] = useState('blocks');
    const [form, setForm] = useState({
        date_from: filters.date_from ?? '',
        date_to: filters.date_to ?? '',
        workweek: filters.workweek ?? '',
        detection_area: toArray(filters.detection_area),
        nonconformity_id: toArray(filters.nonconformity_id),
        customer_id: toArray(filters.customer_id),
        failure_mode: toArray(filters.failure_mode),
    });

    function applyFilters(overrides = {}) {
        const payload = { ...form, ...overrides };
        const params = {};
        Object.entries(payload).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                if (value.length > 0) params[key] = value;
            } else if (value !== '' && value !== false && value != null) {
                params[key] = value;
            }
        });
        router.get('/qdn/dashboard', params, { preserveState: true, preserveScroll: true, replace: true });
    }

    function handleSubmit(e) {
        e.preventDefault();
        applyFilters();
    }

    function setGroupBy(value) {
        applyFilters({ group_by: value });
    }

    function setWorkWeek(value) {
        setForm((f) => ({ ...f, workweek: value, date_from: value ? '' : f.date_from, date_to: value ? '' : f.date_to }));
        applyFilters({ workweek: value || undefined, date_from: value ? '' : form.date_from, date_to: value ? '' : form.date_to });
    }

    const groupByLabel = GROUP_BY_TABS.find((t) => t.value === groupBy)?.label ?? 'Category';

    let running = 0;
    const paretoTotal = paretoData.reduce((sum, r) => sum + r.count, 0);
    const tableRows = paretoData.map((r) => {
        running += r.count;
        return {
            ...r,
            percent: paretoTotal ? (r.count / paretoTotal) * 100 : 0,
            cumulative: paretoTotal ? (running / paretoTotal) * 100 : 0,
        };
    });

    // "QDNs Matching Filters" -- client-side search/sort/pagination over
    // the (already capped-at-500) rows this response came with.
    const [qdnTableQuery, setQdnTableQuery] = useState('');
    const [qdnTableSort, setQdnTableSort] = useState({ field: 'created_at', direction: 'desc' });
    const [qdnTablePage, setQdnTablePage] = useState(1);

    const filteredQdns = useMemo(() => {
        const term = qdnTableQuery.trim().toLowerCase();
        if (!term) return qdns;
        return qdns.filter((q) =>
            [q.qdn_no, q.customer_name, q.device_name, q.detection_area, q.nonconformity_name, q.status_label, q.issued_department]
                .filter(Boolean)
                .some((v) => String(v).toLowerCase().includes(term))
        );
    }, [qdns, qdnTableQuery]);

    const sortedQdns = useMemo(() => {
        const { field, direction } = qdnTableSort;
        const dir = direction === 'asc' ? 1 : -1;
        return [...filteredQdns].sort((a, b) => {
            let av = a[field];
            let bv = b[field];
            if (field === 'created_at') {
                av = av ? new Date(av).getTime() : 0;
                bv = bv ? new Date(bv).getTime() : 0;
                return (av - bv) * dir;
            }
            av = (av ?? '').toString().toLowerCase();
            bv = (bv ?? '').toString().toLowerCase();
            if (av < bv) return -1 * dir;
            if (av > bv) return 1 * dir;
            return 0;
        });
    }, [filteredQdns, qdnTableSort]);

    const qdnTablePageCount = Math.max(1, Math.ceil(sortedQdns.length / DASHBOARD_TABLE_PAGE_SIZE));
    const currentQdnTablePage = Math.min(qdnTablePage, qdnTablePageCount);
    const pagedQdns = sortedQdns.slice(
        (currentQdnTablePage - 1) * DASHBOARD_TABLE_PAGE_SIZE,
        currentQdnTablePage * DASHBOARD_TABLE_PAGE_SIZE
    );

    // A new search term (or a fresh filter response swapping out `qdns`
    // entirely) can shrink the result set below the page you're on --
    // snap back to page 1 rather than showing an empty page.
    useEffect(() => {
        setQdnTablePage(1);
    }, [qdnTableQuery, qdns]);

    function sortQdnTableBy(field) {
        setQdnTableSort((s) => ({
            field,
            direction: s.field === field && s.direction === 'asc' ? 'desc' : 'asc',
        }));
    }

    const topParetoRow = paretoData[0];

    return (
        <div className="qdn-page" style={{ maxWidth: 1400 }}>
            <Head title="QDN Dashboard" />
            <BackLink href={route('dashboard')} label="Back to Main Dashboard" />
            <h1>QDN Dashboard</h1>

            <div className="qdn-kpi-row">
                <div className="qdn-kpi-card">
                    <span className="qdn-kpi-value">{totalCount.toLocaleString()}</span>
                    <span className="qdn-kpi-label">QDNs Matching Filters</span>
                </div>
                <div className="qdn-kpi-card">
                    <span className="qdn-kpi-value">{safeCompliance.averageCompletion}%</span>
                    <span className="qdn-kpi-label">Avg TELFORD Completion</span>
                    <span className="qdn-kpi-sub">{safeCompliance.count.toLocaleString()} QDN{safeCompliance.count === 1 ? '' : 's'} scored</span>
                </div>
                <div className="qdn-kpi-card">
                    <span className="qdn-kpi-value">{topParetoRow ? topParetoRow.count.toLocaleString() : '—'}</span>
                    <span className="qdn-kpi-label">Top {groupByLabel}</span>
                    <span className="qdn-kpi-sub">{topParetoRow ? topParetoRow.label : 'No data for current filters'}</span>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="qdn-records-filters">
                <div className="qdn-field">
                    <label htmlFor="date_from">Date From</label>
                    <input
                        id="date_from"
                        type="date"
                        value={form.date_from}
                        disabled={!!form.workweek}
                        onChange={(e) => setForm({ ...form, date_from: e.target.value })}
                    />
                </div>

                <div className="qdn-field">
                    <label htmlFor="date_to">Date To</label>
                    <input
                        id="date_to"
                        type="date"
                        value={form.date_to}
                        disabled={!!form.workweek}
                        onChange={(e) => setForm({ ...form, date_to: e.target.value })}
                    />
                </div>

                <div className="qdn-field">
                    <label htmlFor="workweek">Work Week</label>
                    <select id="workweek" value={form.workweek} onChange={(e) => setWorkWeek(e.target.value)}>
                        <option value="">-- Any Work Week --</option>
                        {safeFilterOptions.workWeeks.map((w) => (
                            <option key={w.value} value={w.value}>
                                {formatWorkWeekLabel(w)}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="qdn-field">
                    <label htmlFor="detection_area">Detection Area</label>
                    <MultiSelectDropdown
                        id="detection_area"
                        label="Detection Area"
                        placeholder="Any Detection Area"
                        options={safeFilterOptions.detectionAreas.map((area) => ({ value: area, label: area }))}
                        selected={form.detection_area}
                        onChange={(values) => setForm((f) => ({ ...f, detection_area: values }))}
                    />
                </div>

                <div className="qdn-field">
                    <label htmlFor="nonconformity_id">Non-Conformity</label>
                    <MultiSelectDropdown
                        id="nonconformity_id"
                        label="Non-Conformity"
                        placeholder="Any Non-Conformity"
                        options={safeFilterOptions.nonconformities.map((n) => ({ value: n.id, label: n.nonconformity_name }))}
                        selected={form.nonconformity_id}
                        onChange={(values) => setForm((f) => ({ ...f, nonconformity_id: values }))}
                    />
                </div>

                <div className="qdn-field">
                    <label htmlFor="customer_id">Customer</label>
                    <MultiSelectDropdown
                        id="customer_id"
                        label="Customer"
                        placeholder="Any Customer"
                        options={safeFilterOptions.customers.map((c) => ({ value: c.id, label: c.customer_name }))}
                        selected={form.customer_id}
                        onChange={(values) => setForm((f) => ({ ...f, customer_id: values }))}
                    />
                </div>

                <div className="qdn-field">
                    <label htmlFor="failure_mode">Failure Mode</label>
                    <MultiSelectDropdown
                        id="failure_mode"
                        label="Failure Mode"
                        placeholder="Any Failure Mode"
                        options={safeFilterOptions.failureModes.map((mode) => ({ value: mode, label: mode }))}
                        selected={form.failure_mode}
                        onChange={(values) => setForm((f) => ({ ...f, failure_mode: values }))}
                    />
                </div>

                <div className="qdn-field">
                    <label>&nbsp;</label>
                    <button type="submit" className="qdn-btn">
                        Apply Filters
                    </button>
                </div>
            </form>
            <p className="qdn-hint">Check off one or more values in Detection Area, Non-Conformity, Customer, or Failure Mode, then Apply Filters.</p>

            <div className="qdn-checkbox-row qdn-dashboard-section">
                {GROUP_BY_TABS.map((tab) => (
                    <button
                        key={tab.value}
                        type="button"
                        className={`qdn-btn qdn-tab${groupBy === tab.value ? ' is-active' : ''}`}
                        onClick={() => setGroupBy(tab.value)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <section className="qdn-dashboard-section">
                <h2>
                    {groupByLabel} Pareto — {totalCount.toLocaleString()} QDN{totalCount === 1 ? '' : 's'} matching filters
                </h2>
                <ParetoChart data={paretoData} valueLabel={groupBy === 'failure_mode' ? 'Occurrences' : 'QDNs'} />
            </section>

            <section className="qdn-dashboard-section">
                <h2>{groupByLabel} Breakdown</h2>
                <div className="qdn-table-scroll">
                    <table className="qdn-table">
                        <thead>
                            <tr>
                                <th>{groupByLabel}</th>
                                <th>Count</th>
                                <th>% of Total</th>
                                <th>Cumulative %</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tableRows.length === 0 && (
                                <tr>
                                    <td colSpan={4}>No data for the current filters.</td>
                                </tr>
                            )}
                            {tableRows.map((r) => (
                                <tr key={r.label}>
                                    <td>{r.label}</td>
                                    <td>{r.count.toLocaleString()}</td>
                                    <td>{r.percent.toFixed(1)}%</td>
                                    <td>{r.cumulative.toFixed(1)}%</td>
                                </tr>
                            ))}
                        </tbody>
                        {tableRows.length > 0 && (
                            <tfoot>
                                <tr>
                                    <td>Total</td>
                                    <td>{paretoTotal.toLocaleString()}</td>
                                    <td>100%</td>
                                    <td>100%</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </section>

            <section className="qdn-dashboard-section">
                <h2>QDN Compliance Scorecard (TELFORD Standard)</h2>
                <p className="qdn-hint">
                    Rolled up across every QDN matching the filters above -- Preventive Action has no backing
                    field in this app yet, so Block 4 and Question 9 below only average the elements that do
                    exist; everything else, including Systemic/Horizontal Deployment (occurrence count of the
                    same nonconformity), reflects real data.
                </p>

                <div className="qdn-compliance-summary">
                    <div className="qdn-compliance-stat">
                        <span className="qdn-compliance-stat-value">{safeCompliance.averageCompletion}%</span>
                        <span className="qdn-compliance-stat-label">Average completion ({safeCompliance.count.toLocaleString()} QDN{safeCompliance.count === 1 ? '' : 's'} scored)</span>
                    </div>
                </div>

                <div className="qdn-checkbox-row qdn-checkbox-row-wrap">
                    {COMPLIANCE_TABS.map((tab) => (
                        <button
                            key={tab.value}
                            type="button"
                            className={`qdn-btn qdn-tab${complianceTab === tab.value ? ' is-active' : ''}`}
                            onClick={() => setComplianceTab(tab.value)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {complianceTab === 'blocks' && (
                    <div className="qdn-block-grid">
                        {safeCompliance.blockRollup.map((b) => (
                            <div key={b.block} className="qdn-block-tile">
                                <span className="qdn-block-tile-name">{b.block}</span>
                                <span className="qdn-block-tile-focus">{b.focus}</span>
                                <span className="qdn-block-tile-percent">{b.percent}%</span>
                            </div>
                        ))}
                    </div>
                )}

                {complianceTab === 'questions' && (
                    <div className="qdn-compliance-rates">
                        {safeCompliance.questionRollup.map((q) => (
                            <div key={q.no} className="qdn-compliance-bar-row">
                                <span className="qdn-compliance-bar-label">
                                    Q{q.no}. {q.question}
                                    {q.note && <span className="qdn-hint qdn-question-note"> — {q.note}</span>}
                                </span>
                                <div className="qdn-compliance-bar-track">
                                    <div className="qdn-compliance-bar-fill" style={{ width: `${q.percent}%` }} />
                                </div>
                                <span className="qdn-compliance-bar-value">{q.percent}%</span>
                            </div>
                        ))}
                    </div>
                )}

                {complianceTab === 'elements' && (
                    <div className="qdn-compliance-rates">
                        {safeCompliance.elementRates.map((r) => (
                            <div key={r.key} className="qdn-compliance-bar-row">
                                <span className="qdn-compliance-bar-label">{r.label}</span>
                                <div className="qdn-compliance-bar-track">
                                    <div className="qdn-compliance-bar-fill" style={{ width: `${r.percent}%` }} />
                                </div>
                                <span className="qdn-compliance-bar-value">{r.percent}%</span>
                            </div>
                        ))}
                        <div className="qdn-compliance-bar-row">
                            <span className="qdn-compliance-bar-label">9. Preventive Action</span>
                            <span className="qdn-compliance-badge qdn-compliance-badge-na">N/A — not captured</span>
                        </div>
                    </div>
                )}

                <p className="qdn-hint">Jump straight to a paginated detail page:</p>
                <TelfordTabs active={null} />
            </section>

            <section className="qdn-dashboard-section">
                <h2>QDNs Matching Filters</h2>
                {qdns.length >= 500 && (
                    <p className="qdn-hint">
                        Showing the 500 most recent matches. For the full paginated/sortable/searchable list, use{' '}
                        <Link href="/qdn/records">QDN Records</Link>.
                    </p>
                )}

                <div className="qdn-table-toolbar">
                    <div className="qdn-emp-search-input-wrap">
                        <Search size={14} className="qdn-emp-search-icon" />
                        <input
                            type="text"
                            placeholder="Search QDN No, customer, device, area..."
                            value={qdnTableQuery}
                            onChange={(e) => setQdnTableQuery(e.target.value)}
                        />
                    </div>
                    <span className="qdn-table-count">
                        {sortedQdns.length.toLocaleString()} of {qdns.length.toLocaleString()} shown
                    </span>
                </div>

                <div className="qdn-table-scroll">
                    <table className="qdn-table">
                        <thead>
                            <tr>
                                {DASHBOARD_TABLE_COLUMNS.map((col) => (
                                    <DashboardSortableHeader key={col.field} col={col} sort={qdnTableSort} onSort={sortQdnTableBy} />
                                ))}
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pagedQdns.length === 0 && (
                                <tr>
                                    <td colSpan={DASHBOARD_TABLE_COLUMNS.length + 1}>
                                        {qdns.length === 0 ? 'No QDNs match these filters.' : 'No rows match your search.'}
                                    </td>
                                </tr>
                            )}
                            {pagedQdns.map((q) => (
                                <tr key={q.id}>
                                    <td>{q.qdn_no}</td>
                                    <td>{q.customer_name}</td>
                                    <td>{q.device_name}</td>
                                    <td>{q.detection_area}</td>
                                    <td>{q.nonconformity_name}</td>
                                    <td>
                                        <ClassificationBadge classification={q.classification} />
                                    </td>
                                    <td>
                                        <StatusBadge status={q.status} label={q.status_label} />
                                    </td>
                                    <td>{q.issued_department ?? '—'}</td>
                                    <td>{q.created_at ? new Date(q.created_at).toLocaleString() : '—'}</td>
                                    <td>
                                        <Link href={`/qdn/records/${q.id}`} className="qdn-icon-link" title="View" aria-label="View">
                                            <Eye size={16} />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <DashboardLocalPagination
                    page={currentQdnTablePage}
                    pageCount={qdnTablePageCount}
                    pageSize={DASHBOARD_TABLE_PAGE_SIZE}
                    total={sortedQdns.length}
                    onPageChange={setQdnTablePage}
                />
            </section>
        </div>
    );
}

// Same visual/interaction pattern as Records/Index.jsx's SortableHeader,
// adapted to local component state instead of an Inertia round trip --
// there's no server request to make when the data driving the sort is
// already sitting in the page's props.
function DashboardSortableHeader({ col, sort, onSort }) {
    const isActive = sort.field === col.field;
    const Icon = isActive ? (sort.direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

    return (
        <th>
            <button type="button" className="qdn-sort-btn" onClick={() => onSort(col.field)}>
                {col.label}
                <Icon size={13} />
            </button>
        </th>
    );
}

// Client-side counterpart to Records/Index.jsx's Pagination -- same
// markup/classes, but pages over an in-memory array via onPageChange
// instead of following a Laravel paginator's page URLs.
function DashboardLocalPagination({ page, pageCount, pageSize, total, onPageChange }) {
    if (pageCount <= 1) {
        return null;
    }

    const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);

    // A window of page numbers around the current page, capped to 7
    // buttons total, so this doesn't sprawl to 20 links on a full 500-row
    // result set (500 rows / 25 per page = 20 pages).
    const windowSize = 7;
    let start = Math.max(1, page - Math.floor(windowSize / 2));
    let end = Math.min(pageCount, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);
    const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

    return (
        <div className="qdn-pagination">
            <span className="qdn-pagination-summary">
                Showing {from}–{to} of {total}
            </span>
            <div className="qdn-pagination-links">
                <button
                    type="button"
                    className="qdn-pagination-link"
                    disabled={page <= 1}
                    onClick={() => onPageChange(page - 1)}
                >
                    ‹ Prev
                </button>
                {pages.map((p) => (
                    <button
                        key={p}
                        type="button"
                        className={`qdn-pagination-link${p === page ? ' is-active' : ''}`}
                        onClick={() => onPageChange(p)}
                    >
                        {p}
                    </button>
                ))}
                <button
                    type="button"
                    className="qdn-pagination-link"
                    disabled={page >= pageCount}
                    onClick={() => onPageChange(page + 1)}
                >
                    Next ›
                </button>
            </div>
        </div>
    );
}
