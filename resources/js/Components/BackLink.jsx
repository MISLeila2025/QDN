import { Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';

/**
 * Small "back to where you came from" link, placed at the top of every
 * QDN page (each Show/decision page points back to its own queue; each
 * top-level queue/list page points back to the QDN Dashboard).
 */
export default function BackLink({ href, label = 'Back' }) {
    return (
        <Link href={href} className="qdn-back-link">
            <ArrowLeft size={15} />
            {label}
        </Link>
    );
}
