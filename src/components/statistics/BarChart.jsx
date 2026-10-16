// BarChart — simple SVG-free bars with a hover tooltip and under-labels.
// Built like the dashboard's daily bars: server-computed counts only.
import { useState } from "react";

const number = (value) => Number(value ?? 0).toLocaleString("en-US");

export default function BarChart({ items, labelEvery = 2, unit = "", unitLabel = "visit", ariaLabel = "Bar chart" }) {
  const [hover, setHover] = useState(null);
  if (!items || items.length === 0) return null;
  const max = Math.max(1, ...items.map((item) => item.count));
  const active = hover === null ? null : items[hover];
  const leftPct =
    hover === null
      ? 0
      : Math.min(92, Math.max(8, ((hover + 0.5) / items.length) * 100));

  return (
    <div className="relative">
      {active && (
        <div
          role="status"
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg bg-navy px-2.5 py-1.5 text-center shadow-[0_4px_12px_rgba(11,19,48,0.25)]"
          style={{
            left: `${leftPct}%`,
            bottom: `calc(${(active.count / max) * 100}% + 12px)`,
          }}
        >
          <span className="block text-[11px] font-bold leading-tight text-white tabular-nums">
            {number(active.count)} {active.count === 1 ? unitLabel : `${unitLabel}s`}
          </span>
          <span className="mt-0.5 block text-[10px] leading-tight text-slate-300">
            {active.label}
          </span>
        </div>
      )}
      <div className="flex h-40 items-end gap-[3px]" role="img" aria-label={ariaLabel}>
        {items.map((item, index) => (
          <div
            key={item.label}
            tabIndex={0}
            aria-label={`${item.label}: ${item.count}`}
            onMouseEnter={() => setHover(index)}
            onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(index)}
            onBlur={() => setHover(null)}
            className={`min-w-0 flex-1 rounded-t-sm transition-opacity duration-150 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong ${
              item.count === 0 ? "bg-slate-200" : "bg-[var(--chart-1)]"
            }`}
            style={{ height: item.count > 0 ? `${(item.count / max) * 100}%` : "3px" }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-slate-500">
        {items.map((item, index) =>
          index === 0 ||
          index === items.length - 1 ||
          index % labelEvery === 0 ? (
            <span key={item.label}>{item.label}</span>
          ) : null,
        )}
      </div>
      {unit && <p className="mt-1 text-[11px] text-slate-400">{unit}</p>}
    </div>
  );
}
