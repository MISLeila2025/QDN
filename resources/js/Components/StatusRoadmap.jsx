import { BadgeCheck, CheckCircle2, ClipboardCheck, FlaskConical, ShieldCheck, Stamp, Wrench, XCircle } from 'lucide-react';

/**
 * Horizontal roadmap of the full QDN disposition workflow, shown at the
 * top of QdnDetailCard (so it appears on every workflow Show page and the
 * Records/Issued detail views) -- current stage highlighted, completed
 * stages checked off. Mirrors Qdn::STATUS_* / Qdn::STATUS_LABELS in
 * app/Models/Qdn.php.
 */
const STEPS = [
    { key: 'pending_pe', label: 'PE Validation', icon: ClipboardCheck },
    { key: 'for_dept_rca', label: 'Dept RCA', icon: FlaskConical },
    { key: 'for_pe_rca_validation', label: 'PE Validates RCA', icon: ShieldCheck },
    { key: 'for_dept_capa', label: 'Dept CAPA', icon: Wrench },
    { key: 'for_dept_approval', label: 'Dept Approval', icon: Stamp },
    { key: 'for_qa_verification', label: 'QA Verification', icon: BadgeCheck },
    { key: 'closed', label: 'Closed', icon: CheckCircle2 },
];

// Legacy status some existing QDNs may still carry (pre-workflow rebuild).
const ISSUED_ALIAS_INDEX = 1;

export default function StatusRoadmap({ status }) {
    if (status === 'invalid') {
        return (
            <div className="qdn-roadmap qdn-roadmap-invalid">
                <XCircle size={18} />
                <span>Marked Invalid by PE — workflow ended here.</span>
            </div>
        );
    }

    if (status === 'invalid_disposition') {
        return (
            <div className="qdn-roadmap qdn-roadmap-invalid">
                <XCircle size={18} />
                <span>PE Disposition: Invalid — closed after RCA.</span>
            </div>
        );
    }

    const currentIndex = status === 'issued' ? ISSUED_ALIAS_INDEX : STEPS.findIndex((s) => s.key === status);

    return (
        <div className="qdn-roadmap">
            {STEPS.map((step, i) => {
                const Icon = step.icon;
                const isDone = currentIndex >= 0 && i < currentIndex;
                const isCurrent = i === currentIndex;
                const state = isDone ? 'done' : isCurrent ? 'current' : 'upcoming';

                return (
                    <div className={`qdn-roadmap-step is-${state}`} key={step.key}>
                        {i > 0 && <div className="qdn-roadmap-line" />}
                        <div className="qdn-roadmap-icon">
                            {isDone ? <CheckCircle2 size={18} /> : <Icon size={18} />}
                        </div>
                        <div className="qdn-roadmap-label">{step.label}</div>
                    </div>
                );
            })}
        </div>
    );
}
