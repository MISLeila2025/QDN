import React, { useState } from 'react';

/**
 * SourceOfDefect component — drop-in for each RCA cause row.
 *
 * Props:
 *   defectSources      — [{id, label}] from defect_source table
 *   responsibleEmployees — [{id, EMPNAME, emp_dept, station, prodline}] for Man selection
 *   value              — { defect_source_id, issued_to: [{id, emp_no, name, department, station, prodline}] }
 *   onChange           — fn(newValue)
 */
export default function SourceOfDefect({ defectSources = [], responsibleEmployees = [], value = {}, onChange }) {
    const [search, setSearch] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);

    const sourceId    = value.defect_source_id ?? '';
    const issuedTo    = value.issued_to ?? [];
    const selectedSrc = defectSources.find(s => s.id == sourceId);
    const isMan       = selectedSrc?.label === 'Man';

    const filteredEmps = responsibleEmployees.filter(e => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            e.EMPNAME?.toLowerCase().includes(q) ||
            e.EMPLOYID?.toString().includes(q) ||
            e.emp_dept?.toLowerCase().includes(q)
        );
    });

    const handleSourceChange = (id) => {
        onChange({ ...value, defect_source_id: id || null, issued_to: [] });
    };

    const addEmployee = (emp) => {
        if (issuedTo.find(e => e.id === emp.id)) return;
        onChange({
            ...value,
            issued_to: [...issuedTo, {
                id:         emp.id,
                emp_no:     emp.EMPLOYID,
                name:       emp.EMPNAME,
                department: emp.emp_dept,
                station:    emp.station ?? '—',
                prodline:   emp.PRODLINE ?? '—',
            }],
        });
        setSearch('');
        setShowDropdown(false);
    };

    const removeEmployee = (id) => {
        onChange({ ...value, issued_to: issuedTo.filter(e => e.id !== id) });
    };

    return (
        <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
            {/* Source of Defect dropdown */}
            <div>
                <label style={{ fontSize:11,fontWeight:600,color:'#64748b',textTransform:'uppercase',letterSpacing:'.05em',display:'block',marginBottom:4 }}>
                    Source of Defect
                </label>
                <select
                    value={sourceId}
                    onChange={e => handleSourceChange(e.target.value)}
                    style={{ fontSize:13,padding:'7px 10px',borderRadius:7,border:'1px solid #cbd5e1',color:'#1e293b',background:'#f8fafc',width:'100%' }}
                >
                    <option value="">— Select source —</option>
                    {defectSources.map(s => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                </select>
            </div>

            {/* Issued To — only when source = Man */}
            {isMan && (
                <div style={{ border:'1px solid #e2e8f0',borderRadius:10,padding:14,background:'#f8fafc' }}>
                    <div style={{ fontSize:12,fontWeight:700,color:'#0e2841',marginBottom:10 }}>
                        Issued To
                    </div>

                    {/* Search + Add */}
                    <div style={{ position:'relative',marginBottom:10 }}>
                        <input
                            type="text"
                            placeholder="Search employee by name, ID, or department…"
                            value={search}
                            onChange={e => { setSearch(e.target.value); setShowDropdown(true); }}
                            onFocus={() => setShowDropdown(true)}
                            style={{ fontSize:13,padding:'7px 10px',borderRadius:7,border:'1px solid #cbd5e1',width:'100%',boxSizing:'border-box',background:'#fff' }}
                        />
                        {showDropdown && search && (
                            <div style={{ position:'absolute',top:'100%',left:0,right:0,background:'#fff',border:'1px solid #e2e8f0',borderRadius:8,boxShadow:'0 4px 12px rgba(0,0,0,.1)',zIndex:50,maxHeight:220,overflowY:'auto' }}>
                                {filteredEmps.length === 0 ? (
                                    <div style={{ padding:'10px 14px',fontSize:12,color:'#94a3b8' }}>No employees found</div>
                                ) : filteredEmps.slice(0, 30).map(emp => (
                                    <div key={emp.id}
                                        onClick={() => addEmployee(emp)}
                                        style={{ padding:'8px 14px',cursor:'pointer',fontSize:12,borderBottom:'1px solid #f1f5f9',display:'flex',flexDirection:'column',gap:2 }}
                                        onMouseEnter={e => e.currentTarget.style.background='#f0f9ff'}
                                        onMouseLeave={e => e.currentTarget.style.background='#fff'}
                                    >
                                        <span style={{ fontWeight:600,color:'#0e2841' }}>{emp.EMPNAME}</span>
                                        <span style={{ color:'#64748b',fontSize:11 }}>
                                            {emp.EMPLOYID} · {emp.emp_dept} · {emp.PRODLINE ?? '—'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Issued To table */}
                    {issuedTo.length > 0 && (
                        <table style={{ width:'100%',borderCollapse:'collapse',fontSize:12 }}>
                            <thead>
                                <tr style={{ background:'#0e2841' }}>
                                    {['Emp No','Name','Department','Station','Productline','Action'].map(h => (
                                        <th key={h} style={{ padding:'7px 10px',textAlign:'left',color:'#fff',fontWeight:700,fontSize:11,whiteSpace:'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {issuedTo.map((e, i) => (
                                    <tr key={e.id} style={{ background:i%2===0?'#f8fafc':'#fff',borderBottom:'1px solid #f1f5f9' }}>
                                        <td style={{ padding:'6px 10px',color:'#64748b' }}>{e.emp_no}</td>
                                        <td style={{ padding:'6px 10px',fontWeight:600,color:'#0e2841' }}>{e.name}</td>
                                        <td style={{ padding:'6px 10px',color:'#64748b' }}>{e.department}</td>
                                        <td style={{ padding:'6px 10px',color:'#64748b' }}>{e.station}</td>
                                        <td style={{ padding:'6px 10px',color:'#64748b' }}>{e.prodline}</td>
                                        <td style={{ padding:'6px 10px' }}>
                                            <button
                                                type="button"
                                                onClick={() => removeEmployee(e.id)}
                                                style={{ fontSize:11,padding:'3px 10px',borderRadius:6,border:'1px solid #fca5a5',background:'#fee2e2',color:'#dc2626',cursor:'pointer',fontWeight:600 }}
                                            >
                                                Remove
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {issuedTo.length === 0 && (
                        <div style={{ fontSize:12,color:'#94a3b8',textAlign:'center',padding:'12px 0' }}>
                            No employees added yet. Search and add employees above.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
