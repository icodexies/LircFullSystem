// ShareDonut — a donut with a legend for [{label, count}] breakdowns,
// built like the personnel dashboard's work donut. Segments use the navy →
// lavender family only (the design guide's data-page tokens).
import { SHARE_COLORS as COLORS } from "../../services/statistics/chartTheme.js";

export default function ShareDonut({ items, unit = "total" }) {
  const list = (items ?? []).filter((item) => Number(item.count) > 0);
  const total = list.reduce((sum, item) => sum + Number(item.count), 0);
  if (total === 0) return null;

  const segments = list.map((item, index) => ({
    ...item,
    count: Number(item.count),
    color: COLORS[index % COLORS.length],
    pct: (Number(item.count) / total) * 100,
  }));
  const arcs = segments.reduce((rows, segment) => {
    const previous = rows.at(-1);
    return [
      ...rows,
      { ...segment, offset: previous ? previous.offset + previous.pct : 0 },
    ];
  }, []);

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90" role="img" aria-label="Share">
          <circle cx="21" cy="21" r="15.9155" fill="none" className="stroke-slate-100" strokeWidth="5" />
          {arcs.map((arc) => (
            <circle
              key={arc.label}
              cx="21"
              cy="21"
              r="15.9155"
              fill="none"
              style={{ stroke: arc.color }}
              strokeWidth="5"
              strokeDasharray={`${Math.max(arc.pct - 0.8, 0)} ${100 - arc.pct + 0.8}`}
              strokeDashoffset={-arc.offset}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-serif text-2xl font-bold tracking-tight text-ink tabular-nums">
            {total.toLocaleString("en-US")}
          </span>
          <span className="text-[11px] text-slate-500">{unit}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-2">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex min-w-0 items-center gap-2 text-slate-600">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: segment.color }}
              />
              <span className="truncate">{segment.label}</span>
            </span>
            <span className="shrink-0 text-ink tabular-nums">
              {segment.count.toLocaleString("en-US")}{" "}
              <span className="text-slate-500">({Math.round(segment.pct)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
