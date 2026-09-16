import { useState } from "react";
import { Head, Link, router } from "@inertiajs/react";
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, Search } from "lucide-react";
import BackLink from "@/Components/BackLink";

// "Toggle (pending, closed valid, invalid)" -- three buckets, see
// QdnController::RECORDS_STATUS_GROUPS. "Valid" here means "closed
// valid" -- reached Closed via QA Verification's Corrective Action
// implemented? Yes, not just "still in progress."
const STATUS_TABS = [
    { value: "", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "valid", label: "Valid" },
    { value: "invalid", label: "Invalid" },
];

const SORTABLE_COLUMNS = [
    { field: "qdn_no", label: "QDN No" },
    { field: "customer_name", label: "Customer" },
    { field: "device_name", label: "Device" },
    { field: "detection_area", label: "Detection Area" },
    { field: "nonconformity_name", label: "Non-Conformity" },
    { field: "classification", label: "Classification" },
    { field: "status", label: "Status" },
    { field: "issued_department", label: "Issued Department" },
    { field: "created_at", label: "Submitted" },
];

// "WW34 · 2026 (Aug 18–24)" -- date_start/date_end come from
// AnalogCalendar's MIN/MAX(cal_date) for that (cal_year, cal_workweek)
// pair (see QdnController::records()'s filterOptions.workWeeks).
function formatWorkWeekLabel(w) {
    const fmt = (v) =>
        v
            ? new Date(v).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
              })
            : null;
    const start = fmt(w.date_start);
    const end = fmt(w.date_end);
    const range = start && end ? ` (${start}–${end})` : "";
    return `WW${w.workweek} · ${w.year}${range}`;
}

/**
 * Full QDN record list -- every QDN ever created, searchable/filterable/
 * sortable/paginated. Not department-scoped: this is a full history view.
 * Click through to Qdn/Records/Show for every field on a given QDN.
 *
 * "Toggle (pending, closed valid, invalid)" -- see
 * QdnController::RECORDS_STATUS_GROUPS for exactly which statuses land in
 * each bucket. Pending = still ongoing. Valid = "closed valid" -- reached
 * Closed via QA Verification's Corrective Action implemented? Yes (the
 * only way this workflow ever sets STATUS_CLOSED). Invalid = PE rejected
 * it outright, or PE's post-RCA disposition was Invalid.
 *
 * Filters/sort/pagination all round-trip through the URL query string
 * (Laravel's paginate()->withQueryString() + Inertia's router.get with
 * preserveState) so the page is bookmarkable/shareable and the back
 * button works as expected -- this is a full-page filter form (submit to
 * apply), not a live-as-you-type search like EmployeeSearchSelect, since
 * it's combining seven different filter inputs at once rather than one
 * text field.
 *
 * Props (from QdnController@records): qdns (Laravel paginator: data +
 * links + meta), filters (current query params, for pre-filling the
 * form), filterOptions (detectionAreas, nonconformities, customers,
 * workWeeks -- every distinct calendar work-week from analog_calendar)
 */
export default function RecordsIndex({ qdns, filters, filterOptions }) {
    const [form, setForm] = useState({
        q: filters.q ?? "",
        date_from: filters.date_from ?? "",
        date_to: filters.date_to ?? "",
        workweek: filters.workweek ?? "",
        detection_area: filters.detection_area ?? "",
        nonconformity_id: filters.nonconformity_id ?? "",
        customer_id: filters.customer_id ?? "",
    });

    function applyFilters(overrides = {}) {
        const payload = { ...form, ...overrides };
        // Drop empty values so the URL stays clean instead of filling up
        // with ?date_from=&customer_id=&...
        const params = Object.fromEntries(
            Object.entries(payload).filter(([, v]) => v !== "" && v !== false),
        );
        router.get("/qdn/records", params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    }

    function handleSubmit(e) {
        e.preventDefault();
        applyFilters();
    }

    function setStatusGroup(value) {
        applyFilters({ status_group: value || undefined });
    }

    function setWorkWeek(value) {
        setForm((f) => ({
            ...f,
            workweek: value,
            date_from: value ? "" : f.date_from,
            date_to: value ? "" : f.date_to,
        }));
        applyFilters({
            workweek: value || undefined,
            date_from: value ? "" : form.date_from,
            date_to: value ? "" : form.date_to,
        });
    }

    function sortBy(field) {
        const direction =
            filters.sort === field && filters.direction === "asc"
                ? "desc"
                : "asc";
        applyFilters({ sort: field, direction });
    }

    const activeStatusGroup = filters.status_group ?? "";

    return (
        <div className="qdn-page" style={{ maxWidth: 1400 }}>
            <Head title="QDN Records" />
            <BackLink href="/qdn/dashboard" label="Back to QDN Dashboard" />
            <h1>QDN Records</h1>

            <div className="qdn-checkbox-row qdn-checkbox-row-wrap qdn-dashboard-section">
                {STATUS_TABS.map((tab) => (
                    <button
                        key={tab.value || "all"}
                        type="button"
                        className={`qdn-btn qdn-tab${activeStatusGroup === tab.value ? " is-active" : ""}`}
                        onClick={() => setStatusGroup(tab.value)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <form onSubmit={handleSubmit} className="qdn-records-filters">
                <div className="qdn-field">
                    <label htmlFor="q">Search</label>
                    <div className="qdn-emp-search-input-wrap">
                        <Search size={14} className="qdn-emp-search-icon" />
                        <input
                            id="q"
                            type="text"
                            placeholder="QDN No, customer, device…"
                            value={form.q}
                            onChange={(e) =>
                                setForm({ ...form, q: e.target.value })
                            }
                        />
                    </div>
                </div>

                <div className="qdn-field">
                    <label htmlFor="customer_id">Customer</label>
                    <select
                        id="customer_id"
                        value={form.customer_id}
                        onChange={(e) =>
                            setForm({ ...form, customer_id: e.target.value })
                        }
                    >
                        <option value="">-- All Customers --</option>
                        {filterOptions.customers.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.customer_name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="qdn-field">
                    <label htmlFor="nonconformity_id">Non-Conformity</label>
                    <select
                        id="nonconformity_id"
                        value={form.nonconformity_id}
                        onChange={(e) =>
                            setForm({
                                ...form,
                                nonconformity_id: e.target.value,
                            })
                        }
                    >
                        <option value="">-- All Non-Conformities --</option>
                        {filterOptions.nonconformities.map((n) => (
                            <option key={n.id} value={n.id}>
                                {n.nonconformity_name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="qdn-field">
                    <label htmlFor="detection_area">Detection Area</label>
                    <select
                        id="detection_area"
                        value={form.detection_area}
                        onChange={(e) =>
                            setForm({ ...form, detection_area: e.target.value })
                        }
                    >
                        <option value="">-- All Detection Areas --</option>
                        {filterOptions.detectionAreas.map((area) => (
                            <option key={area} value={area}>
                                {area}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="qdn-field">
                    <label htmlFor="date_from">Date From</label>
                    <input
                        id="date_from"
                        type="date"
                        value={form.date_from}
                        disabled={!!form.workweek}
                        onChange={(e) =>
                            setForm({ ...form, date_from: e.target.value })
                        }
                    />
                </div>

                <div className="qdn-field">
                    <label htmlFor="date_to">Date To</label>
                    <input
                        id="date_to"
                        type="date"
                        value={form.date_to}
                        disabled={!!form.workweek}
                        onChange={(e) =>
                            setForm({ ...form, date_to: e.target.value })
                        }
                    />
                </div>

                <div className="qdn-field">
                    <label htmlFor="workweek">Work Week</label>
                    <select
                        id="workweek"
                        value={form.workweek}
                        onChange={(e) => setWorkWeek(e.target.value)}
                    >
                        <option value="">-- Any Work Week --</option>
                        {filterOptions.workWeeks.map((w) => (
                            <option key={w.value} value={w.value}>
                                {formatWorkWeekLabel(w)}
                            </option>
                        ))}
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
                            {SORTABLE_COLUMNS.map((col) => (
                                <SortableHeader
                                    key={col.field}
                                    col={col}
                                    filters={filters}
                                    onSort={sortBy}
                                />
                            ))}
                            <th>Package</th>
                            <th>Machine No</th>
                            <th>Failure Mode</th>
                            <th>Issued By</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {qdns.data.length === 0 && (
                            <tr>
                                <td colSpan={13}>
                                    No QDN records match these filters.
                                </td>
                            </tr>
                        )}
                        {qdns.data.map((q) => (
                            <tr key={q.id}>
                                <td>{q.qdn_no}</td>
                                <td>{q.customer_name}</td>
                                <td>{q.device_name}</td>
                                <td>{q.detection_area}</td>
                                <td>{q.nonconformity_name}</td>
                                <td>{q.classification}</td>
                                <td>{q.status_label}</td>
                                <td>{q.issued_department ?? "—"}</td>
                                <td>
                                    {q.created_at
                                        ? new Date(
                                              q.created_at,
                                          ).toLocaleString()
                                        : "—"}
                                </td>
                                <td>{q.package_name}</td>
                                <td>{q.machine_num}</td>
                                <td>{q.failure_modes || "—"}</td>
                                <td>{q.issued_by}</td>
                                <td>
                                    <Link
                                        href={`/qdn/records/${q.id}`}
                                        className="qdn-icon-link"
                                        title="View"
                                        aria-label="View"
                                    >
                                        <Eye size={16} />
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Pagination qdns={qdns} />
        </div>
    );
}

function SortableHeader({ col, filters, onSort }) {
    const isActive = filters.sort === col.field;
    const Icon = isActive
        ? filters.direction === "asc"
            ? ArrowUp
            : ArrowDown
        : ArrowUpDown;

    return (
        <th>
            <button
                type="button"
                className="qdn-sort-btn"
                onClick={() => onSort(col.field)}
            >
                {col.label}
                <Icon size={13} />
            </button>
        </th>
    );
}

function Pagination({ qdns }) {
    if (qdns.last_page <= 1) {
        return null;
    }

    return (
        <div className="qdn-pagination">
            <span className="qdn-pagination-summary">
                Showing {qdns.from ?? 0}–{qdns.to ?? 0} of {qdns.total}
            </span>
            <div className="qdn-pagination-links">
                {qdns.links.map((link, i) => (
                    <PaginationLink key={i} link={link} />
                ))}
            </div>
        </div>
    );
}

function PaginationLink({ link }) {
    // Laravel's paginator labels use "&laquo; Previous" / "Next &raquo;"
    // HTML entities -- decode via dangerouslySetInnerHTML rather than
    // showing the literal "&laquo;" text.
    if (!link.url) {
        return (
            <span
                className="qdn-pagination-link is-disabled"
                dangerouslySetInnerHTML={{ __html: link.label }}
            />
        );
    }

    return (
        <Link
            href={link.url}
            preserveState
            preserveScroll
            className={`qdn-pagination-link${link.active ? " is-active" : ""}`}
            dangerouslySetInnerHTML={{ __html: link.label }}
        />
    );
}
