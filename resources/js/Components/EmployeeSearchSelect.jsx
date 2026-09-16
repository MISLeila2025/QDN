import { useEffect, useRef, useState } from 'react';
import { Search, User, X } from 'lucide-react';

/**
 * Server-side, type-ahead employee picker -- type an EMPLOYID or part of
 * an EMPLOYNAME and pick from the dropdown. Backs every "select an
 * employee" field across the QDN feature (RCA Select Responsible / Issued
 * To, PE Validate's Issued To, CAPA Inspected By / Operator / Supervisor /
 * Corrective Responsible). Queries GET /employees/search
 * (EmployeeSearchController), debounced as you type, instead of the app
 * preloading a whole roster into page props up front.
 *
 * Props:
 *   value        - the currently selected employee object, or null/
 *                   undefined. Only `EMPLOYID` is required to render a
 *                   selection; pass EMPLOYNAME/DEPARTMENT too when you
 *                   have them so the chip reads nicely without a lookup.
 *   onChange(emp)  - called with the full employee object on selection,
 *                   or null when cleared.
 *   department   - optional: scope results to one DEPARTMENT.
 *   titles       - optional: array of exact JOB_TITLE matches.
 *   like         - optional: array of JOB_TITLE LIKE patterns (e.g.
 *                   ['%Supervisor%']).
 *   placeholder
 *   compact      - smaller footprint for use inside a table cell.
 */
export default function EmployeeSearchSelect({
    value,
    onChange,
    department,
    titles,
    like,
    placeholder = 'Type Employee No or Name…',
    compact = false,
}) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [highlighted, setHighlighted] = useState(-1);
    const boxRef = useRef(null);
    const debounceRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(e) {
            if (boxRef.current && !boxRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
    }, []);

    function runSearch(term) {
        setLoading(true);
        const params = new URLSearchParams();
        if (term) params.set('q', term);
        if (department) params.set('department', department);
        (titles ?? []).forEach((t) => params.append('titles[]', t));
        (like ?? []).forEach((l) => params.append('like[]', l));

        fetch(`/employees/search?${params.toString()}`, { headers: { Accept: 'application/json' } })
            .then((res) => {
                if (!res.ok) {
                    throw new Error(`Employee search failed: HTTP ${res.status}`);
                }
                return res.json();
            })
            .then((json) => setResults(json.employees ?? []))
            .catch((err) => {
                console.error(err);
                setResults([]);
            })
            .finally(() => setLoading(false));
    }

    function handleInputChange(e) {
        const term = e.target.value;
        setQuery(term);
        setOpen(true);
        setHighlighted(-1);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => runSearch(term), 300);
    }

    function handleFocus() {
        setOpen(true);
        if (results.length === 0 && !loading) runSearch(query);
    }

    function select(emp) {
        onChange(emp);
        setQuery('');
        setResults([]);
        setOpen(false);
        setHighlighted(-1);
    }

    function clear() {
        onChange(null);
        setQuery('');
    }

    function handleKeyDown(e) {
        if (!open || results.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlighted((h) => Math.min(h + 1, results.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlighted((h) => Math.max(h - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlighted >= 0 && results[highlighted]) select(results[highlighted]);
        } else if (e.key === 'Escape') {
            setOpen(false);
        }
    }

    return (
        <div className={`qdn-emp-search${compact ? ' qdn-emp-search-compact' : ''}`} ref={boxRef}>
            {value?.EMPLOYID ? (
                <div className="qdn-emp-search-selected">
                    <User size={14} className="qdn-emp-search-icon" />
                    <span>
                        {value.EMPLOYID} — {value.EMPLOYNAME}
                        {!compact && value.DEPARTMENT ? ` (${value.DEPARTMENT})` : ''}
                    </span>
                    <button type="button" className="qdn-emp-search-clear" onClick={clear} aria-label="Clear selection">
                        <X size={13} />
                    </button>
                </div>
            ) : (
                <div className="qdn-emp-search-input-wrap">
                    <Search size={14} className="qdn-emp-search-icon" />
                    <input
                        type="text"
                        value={query}
                        placeholder={placeholder}
                        onChange={handleInputChange}
                        onFocus={handleFocus}
                        onKeyDown={handleKeyDown}
                    />
                </div>
            )}

            {open && !value?.EMPLOYID && (
                <div className="qdn-emp-search-dropdown">
                    {loading && <div className="qdn-emp-search-empty">Searching…</div>}
                    {!loading && results.length === 0 && (
                        <div className="qdn-emp-search-empty">
                            {query ? 'No matching employees.' : 'Type to search…'}
                        </div>
                    )}
                    {!loading &&
                        results.map((emp, i) => (
                            <button
                                type="button"
                                key={emp.EMPLOYID}
                                className={`qdn-emp-search-option${i === highlighted ? ' is-highlighted' : ''}`}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => select(emp)}
                            >
                                <User size={13} />
                                <span>
                                    <strong>{emp.EMPLOYID}</strong> — {emp.EMPLOYNAME}
                                    {emp.DEPARTMENT ? <em> · {emp.DEPARTMENT}</em> : null}
                                </span>
                            </button>
                        ))}
                </div>
            )}
        </div>
    );
}
