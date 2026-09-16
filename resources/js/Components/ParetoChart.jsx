import { useRef, useState } from 'react';

// Bar/line colors -- validated together against this app's light surface
// via the dataviz skill's palette validator (categorical slots blue +
// orange, worst-case CVD ΔE 30.2, normal-vision ΔE 40.7, both well clear
// of the 8/15 floors). Blue matches the app's existing primary color
// (buttons, links, active tab); orange is the classic Pareto
// cumulative-line color, kept visually distinct from the app's own
// status colors (green/red/amber) used elsewhere.
const BAR_COLOR = '#1d4ed8';
const LINE_COLOR = '#eb6834';
const OTHER_LABEL = 'Other';
const MAX_CATEGORIES = 10;

// Rounds up to a "clean" axis max (1/2/5/10 x a power of ten) so the left
// axis reads 0 / 20 / 40 / 60 / 80 rather than an arbitrary max like 73.
function niceMax(value) {
    if (value <= 0) return 10;
    const magnitude = 10 ** Math.floor(Math.log10(value));
    const residual = value / magnitude;
    let niceResidual;
    if (residual <= 1) niceResidual = 1;
    else if (residual <= 2) niceResidual = 2;
    else if (residual <= 5) niceResidual = 5;
    else niceResidual = 10;
    return niceResidual * magnitude;
}

/**
 * Pareto chart -- ranked bars (count per category, descending) plus a
 * cumulative-percentage line, the standard quality/Six-Sigma tool this
 * whole feature is built around. This is a deliberate exception to "never
 * a dual-axis chart": the two series aren't independent metrics on
 * unrelated scales being visually conflated, the cumulative line is
 * mathematically *derived* from the bars themselves (running sum / total)
 * -- that relationship is the entire point of a Pareto chart, not a
 * coincidence two axes are hiding.
 *
 * No charting library dependency -- hand-rolled inline SVG, so this
 * doesn't require adding anything to package.json.
 *
 * Props: data ([{ label, count }]), valueLabel (legend/tooltip name for
 * the bar series, e.g. "QDNs" or "Occurrences").
 */
export default function ParetoChart({ data, valueLabel = 'Count' }) {
    const [hover, setHover] = useState(null);
    const containerRef = useRef(null);

    const sorted = [...data].sort((a, b) => b.count - a.count);
    let rows = sorted;
    if (sorted.length > MAX_CATEGORIES) {
        const head = sorted.slice(0, MAX_CATEGORIES - 1);
        const tailCount = sorted.slice(MAX_CATEGORIES - 1).reduce((sum, r) => sum + r.count, 0);
        rows = [...head, { label: OTHER_LABEL, count: tailCount }];
    }

    const total = rows.reduce((sum, r) => sum + r.count, 0);

    if (total === 0) {
        return <p className="qdn-pareto-empty">No data for the current filters.</p>;
    }

    let running = 0;
    const points = rows.map((r) => {
        running += r.count;
        return { ...r, percent: (r.count / total) * 100, cumulative: (running / total) * 100 };
    });

    const width = 860;
    const height = 380;
    const margin = { top: 28, right: 52, bottom: 104, left: 60 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;

    const leftMax = niceMax(Math.max(...points.map((p) => p.count)));
    const bandWidth = plotWidth / points.length;
    const barWidth = Math.min(40, bandWidth * 0.55);

    const xCenter = (i) => margin.left + bandWidth * i + bandWidth / 2;
    const yCount = (count) => margin.top + plotHeight - (count / leftMax) * plotHeight;
    const yPercent = (pct) => margin.top + plotHeight - (pct / 100) * plotHeight;

    const leftTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(leftMax * f));
    const rightTicks = [0, 25, 50, 75, 100];
    const baselineY = margin.top + plotHeight;
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xCenter(i)} ${yPercent(p.cumulative)}`).join(' ');

    function showTooltip(e, point) {
        const rect = containerRef.current.getBoundingClientRect();
        setHover({ point, x: e.clientX - rect.left, y: e.clientY - rect.top });
    }

    return (
        <div className="qdn-pareto" ref={containerRef}>
            <div className="qdn-pareto-legend">
                <span className="qdn-pareto-legend-item">
                    <span className="qdn-pareto-swatch qdn-pareto-swatch-bar" />
                    {valueLabel}
                </span>
                <span className="qdn-pareto-legend-item">
                    <span className="qdn-pareto-swatch qdn-pareto-swatch-line" />
                    Cumulative %
                </span>
            </div>

            <svg viewBox={`0 0 ${width} ${height}`} className="qdn-pareto-svg" role="img" aria-label={`Pareto chart of ${valueLabel} by category`}>
                {leftTicks.map((t, i) => (
                    <line key={`grid-${i}`} x1={margin.left} x2={width - margin.right} y1={yCount(t)} y2={yCount(t)} className="qdn-pareto-gridline" />
                ))}

                {leftTicks.map((t, i) => (
                    <text key={`lt-${i}`} x={margin.left - 10} y={yCount(t)} className="qdn-pareto-axis-label" textAnchor="end" dominantBaseline="middle">
                        {t.toLocaleString()}
                    </text>
                ))}

                {rightTicks.map((t, i) => (
                    <text key={`rt-${i}`} x={width - margin.right + 10} y={yPercent(t)} className="qdn-pareto-axis-label" textAnchor="start" dominantBaseline="middle">
                        {t}%
                    </text>
                ))}

                <line x1={margin.left} x2={width - margin.right} y1={baselineY} y2={baselineY} className="qdn-pareto-baseline" />

                {points.map((p, i) => {
                    const x = xCenter(i) - barWidth / 2;
                    const y = yCount(p.count);
                    return (
                        <rect
                            key={`bar-${i}`}
                            x={x}
                            y={y}
                            width={barWidth}
                            height={Math.max(baselineY - y, 0)}
                            rx={4}
                            fill={BAR_COLOR}
                            className="qdn-pareto-bar"
                            onMouseEnter={(e) => showTooltip(e, p)}
                            onMouseMove={(e) => showTooltip(e, p)}
                            onMouseLeave={() => setHover(null)}
                        />
                    );
                })}

                {/* "Columns -> value on the cap" -- shown for every bar since
                    this list is capped at 10 categories, not per line-point. */}
                {points.map((p, i) => (
                    <text key={`bv-${i}`} x={xCenter(i)} y={yCount(p.count) - 8} className="qdn-pareto-bar-value" textAnchor="middle">
                        {p.count.toLocaleString()}
                    </text>
                ))}

                <path d={linePath} stroke={LINE_COLOR} className="qdn-pareto-line" fill="none" />

                {points.map((p, i) => (
                    <circle
                        key={`dot-${i}`}
                        cx={xCenter(i)}
                        cy={yPercent(p.cumulative)}
                        r={5}
                        fill={LINE_COLOR}
                        className="qdn-pareto-dot"
                        onMouseEnter={(e) => showTooltip(e, p)}
                        onMouseMove={(e) => showTooltip(e, p)}
                        onMouseLeave={() => setHover(null)}
                    />
                ))}

                {/* Direct label reserved for the line's endpoint only --
                    "label the endpoint... let the tooltip/table carry the rest." */}
                {points.length > 0 && (
                    <text
                        x={xCenter(points.length - 1)}
                        y={yPercent(points[points.length - 1].cumulative) - 12}
                        className="qdn-pareto-line-label"
                        textAnchor="end"
                    >
                        {points[points.length - 1].cumulative.toFixed(0)}%
                    </text>
                )}

                {points.map((p, i) => (
                    <g key={`xl-${i}`}>
                        <title>{p.label}</title>
                        <text
                            x={xCenter(i)}
                            y={baselineY + 16}
                            className="qdn-pareto-axis-label"
                            textAnchor="end"
                            transform={`rotate(-35 ${xCenter(i)} ${baselineY + 16})`}
                        >
                            {p.label.length > 18 ? `${p.label.slice(0, 17)}…` : p.label}
                        </text>
                    </g>
                ))}
            </svg>

            {hover && (
                <div className="qdn-pareto-tooltip" style={{ left: hover.x + 12, top: hover.y - 12 }}>
                    <strong>{hover.point.label}</strong>
                    <div>
                        {valueLabel}: {hover.point.count.toLocaleString()}
                    </div>
                    <div>Share: {hover.point.percent.toFixed(1)}%</div>
                    <div>Cumulative: {hover.point.cumulative.toFixed(1)}%</div>
                </div>
            )}
        </div>
    );
}
