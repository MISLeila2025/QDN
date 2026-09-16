import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

/**
 * A closed-by-default multi-select dropdown -- replaces the native
 * <select multiple size={4}> fields on the QDN Dashboard (Detection
 * Area / Non-Conformity / Customer / Failure Mode), which stayed
 * permanently open as a 4-row listbox and needed Ctrl/Cmd-click to pick
 * more than one value -- not an obvious interaction, and it ate a lot of
 * vertical space for filters used occasionally. This collapses to a
 * single-line button (like every other filter field) showing "Any X",
 * one label, or "N selected"; the panel underneath is checkboxes, so
 * picking several values is just clicking each one.
 *
 * Values are always compared as strings -- matches how these filters
 * already round-trip through the URL query string (?nonconformity_id[]=3
 * arrives back as "3", a string, not a number), so `selected` and each
 * option's `value` are coerced via String() before comparing.
 *
 * Props: id, label (used in the search placeholder + clear button's
 * aria-label), options ([{value, label}]), selected (array of the
 * currently-checked values), onChange(nextArray), placeholder (button
 * text when nothing is selected), searchable (default true; only shows
 * the search box once there are more than 6 options -- not worth it for
 * a short list).
 */
export default function MultiSelectDropdown({ id, label, options, selected, onChange, placeholder = 'Any', searchable = true }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const rootRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(e) {
            if (rootRef.current && !rootRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        function handleKeyDown(e) {
            if (e.key === 'Escape') setOpen(false);
        }
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    useEffect(() => {
        if (!open) setQuery('');
    }, [open]);

    const selectedSet = new Set((selected ?? []).map(String));
    const term = query.trim().toLowerCase();
    const filteredOptions = term ? options.filter((o) => o.label.toLowerCase().includes(term)) : options;
    const showSearch = searchable && options.length > 6;

    function toggleValue(value) {
        const v = String(value);
        const next = selectedSet.has(v) ? (selected ?? []).filter((s) => String(s) !== v) : [...(selected ?? []), v];
        onChange(next);
    }

    function clearAll(e) {
        e.stopPropagation();
        onChange([]);
    }

    const selectedLabels = options.filter((o) => selectedSet.has(String(o.value))).map((o) => o.label);
    const summary = selectedLabels.length === 0 ? placeholder : selectedLabels.length === 1 ? selectedLabels[0] : `${selectedLabels.length} selected`;

    return (
        <div className="qdn-multiselect" ref={rootRef}>
            <button
                type="button"
                id={id}
                className={`qdn-multiselect-toggle${open ? ' is-open' : ''}${selectedLabels.length ? ' has-value' : ''}`}
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <span className="qdn-multiselect-summary">{summary}</span>
                {selectedLabels.length > 0 && (
                    <span className="qdn-multiselect-clear" onClick={clearAll} role="button" aria-label={`Clear ${label}`}>
                        <X size={12} />
                    </span>
                )}
                <ChevronDown size={14} className="qdn-multiselect-chevron" />
            </button>

            {open && (
                <div className="qdn-multiselect-panel" role="listbox" aria-multiselectable="true">
                    {showSearch && (
                        <div className="qdn-multiselect-search">
                            <Search size={13} />
                            {/* eslint-disable-next-line jsx-a11y/no-autofocus -- opening the panel IS the intent to search/pick, same as any dropdown */}
                            <input
                                type="text"
                                autoFocus
                                placeholder={`Search ${label}...`}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                            />
                        </div>
                    )}
                    <div className="qdn-multiselect-options">
                        {filteredOptions.length === 0 && <div className="qdn-multiselect-empty">No matches.</div>}
                        {filteredOptions.map((o) => (
                            <label key={o.value} className="qdn-multiselect-option">
                                <input type="checkbox" checked={selectedSet.has(String(o.value))} onChange={() => toggleValue(o.value)} />
                                {o.label}
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
