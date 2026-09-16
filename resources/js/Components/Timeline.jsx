/**
 * Shared vertical timeline layout -- replaces plain numbered section
 * headers ("1. Root Cause of Event", "2. ...", "3. ...") with an icon
 * node + connecting line down the left edge, roadmap-style. Used by
 * Rca/Show.jsx, Capa/Show.jsx (the forms), and QdnDetailCard.jsx (the
 * read-only view), so both the editable and read-only presentations of
 * the same sections stay visually consistent.
 */
export function Timeline({ children }) {
    return <div className="qdn-timeline">{children}</div>;
}

export function TimelineItem({ icon: Icon, title, children }) {
    return (
        <div className="qdn-timeline-item">
            <div className="qdn-timeline-icon">
                <Icon size={18} />
            </div>
            <div className="qdn-timeline-content">
                {title && <h2 className="qdn-timeline-title">{title}</h2>}
                {children}
            </div>
        </div>
    );
}
