import { Link } from '@inertiajs/react';

/**
 * Shared table for every workflow stage's Index page (Qdn/Rca/Index,
 * Qdn/PeRca/Index, Qdn/Capa/Index, Qdn/Approval/Index,
 * Qdn/QaVerification/Index) plus Qdn/Records/Index. Each row shows a
 * status column when the caller passes `showStatus` (Records list mixes
 * every status together, so it needs one; a single-stage queue already
 * has one status by definition and doesn't).
 *
 * `actionIcon` (a lucide-react icon component) renders the action link as
 * an icon instead of plain text -- `actionLabel` still becomes the
 * link's title/aria-label either way, so it's never lost, just not shown
 * as visible text when an icon is supplied. Each caller's icon matches
 * that stage's icon in StatusRoadmap.jsx, so the same icon means the same
 * workflow step everywhere in the app.
 */
export default function QdnListTable({
    qdns,
    dateLabel = 'Date',
    dateField = 'created_at',
    actionLabel,
    actionHref,
    actionIcon: ActionIcon,
    emptyLabel = 'No records found.',
    showStatus = false,
}) {
    const columnCount = 5 + (showStatus ? 1 : 0) + (actionLabel ? 1 : 0);

    return (
        <table className="qdn-table">
            <thead>
                <tr>
                    <th>QDN No</th>
                    <th>Customer</th>
                    <th>Device</th>
                    <th>Classification</th>
                    {showStatus && <th>Status</th>}
                    <th>{dateLabel}</th>
                    {actionLabel && <th>Action</th>}
                </tr>
            </thead>
            <tbody>
                {qdns.length === 0 && (
                    <tr>
                        <td colSpan={columnCount}>{emptyLabel}</td>
                    </tr>
                )}
                {qdns.map((q) => (
                    <tr key={q.id}>
                        <td>{q.qdn_no}</td>
                        <td>{q.customer_name}</td>
                        <td>{q.device_name}</td>
                        <td>{q.classification}</td>
                        {showStatus && <td>{q.status_label ?? q.status}</td>}
                        <td>{q[dateField] ? new Date(q[dateField]).toLocaleString() : '—'}</td>
                        {actionLabel && (
                            <td>
                                <Link
                                    href={actionHref(q)}
                                    className={ActionIcon ? 'qdn-icon-link' : undefined}
                                    title={actionLabel}
                                    aria-label={actionLabel}
                                >
                                    {ActionIcon ? <ActionIcon size={16} /> : actionLabel}
                                </Link>
                            </td>
                        )}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
