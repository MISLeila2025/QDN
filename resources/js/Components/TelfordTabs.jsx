import { Link } from '@inertiajs/react';

// Shared tab bar linking the three TELFORD standard detail pages together
// -- each tab is still its own route/controller action with its own
// filtered, paginated query (Compliance Detail / Corrective Action
// Tracker / Effectiveness Verification all scale independently, see
// QdnController@complianceIndex / @correctiveActionTracker /
// @effectivenessVerification), but rendering the same tab strip at the
// top of all three makes switching between them feel like one screen
// instead of three separate destinations. `active` is the current page's
// own path, so its tab highlights; the others navigate via Inertia's
// <Link> (a normal fast page visit, not a client-only toggle -- each tab
// still needs its own request since each has its own query/pagination).
const TABS = [
    { href: '/qdn/compliance', label: 'Compliance Detail' },
    { href: '/qdn/corrective-action-tracker', label: 'Corrective Action Tracker' },
    { href: '/qdn/effectiveness-verification', label: 'Effectiveness Verification' },
];

export default function TelfordTabs({ active }) {
    return (
        <div className="qdn-checkbox-row qdn-checkbox-row-wrap qdn-dashboard-section">
            {TABS.map((tab) => (
                <Link
                    key={tab.href}
                    href={tab.href}
                    className={`qdn-btn qdn-tab${active === tab.href ? ' is-active' : ''}`}
                >
                    {tab.label}
                </Link>
            ))}
        </div>
    );
}
