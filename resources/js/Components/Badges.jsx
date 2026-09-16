// Shared status/classification badges -- keyed off the raw enum values
// (Qdn::STATUS_* / the classification column), not the human label, so
// the color survives any future relabeling. Three tones for status keeps
// this readable at a glance across 10 possible states: green once a QDN
// is genuinely done (closed), red for the two terminal "this was
// rejected" outcomes, amber for everything still moving through the
// workflow. Add a new status to STATUS_TONE (defaults to "pending" if
// missed, so a badge always renders even if this list drifts behind
// Qdn::STATUS_LABELS).
const STATUS_TONE = {
    pending_pe: 'pending',
    issued: 'pending',
    for_dept_rca: 'pending',
    for_pe_rca_validation: 'pending',
    for_dept_capa: 'pending',
    for_dept_approval: 'pending',
    for_qa_verification: 'pending',
    closed: 'success',
    invalid: 'danger',
    invalid_disposition: 'danger',
};

export function StatusBadge({ status, label }) {
    const tone = STATUS_TONE[status] ?? 'pending';
    return <span className={`qdn-status-badge qdn-status-badge-${tone}`}>{label ?? status}</span>;
}

const CLASSIFICATION_TONE = {
    Minor: 'minor',
    Major: 'major',
    Critical: 'critical',
};

export function ClassificationBadge({ classification }) {
    if (!classification) {
        return <span className="qdn-classification-badge qdn-classification-badge-none">—</span>;
    }
    const tone = CLASSIFICATION_TONE[classification] ?? 'minor';
    return <span className={`qdn-classification-badge qdn-classification-badge-${tone}`}>{classification}</span>;
}
