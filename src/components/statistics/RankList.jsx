// RankList — ranked rows: a lavender rank number, the label (and optional
// small second line), the count, and an optional shortcut button that opens
// the actual record (OPAC book window / Users member record).
import { Link } from "react-router-dom";

export default function RankList({ items, empty = "Nothing to show yet." }) {
  const list = items ?? [];
  if (list.length === 0)
    return <p className="py-2 text-xs text-slate-500">{empty}</p>;
  const max = Math.max(1, ...list.map((item) => Number(item.count)));

  return (
    <ul className="divide-y divide-slate-100">
      {list.map((item, index) => (
        <li key={`${item.label}-${index}`} className="flex items-start gap-3 py-2.5">
          <span
            aria-hidden="true"
            className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-tint text-[10px] font-bold text-accent"
          >
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="min-w-0">
                <span className="block truncate font-medium text-ink">
                  {item.label}
                </span>
                {item.sub && (
                  <span className="block truncate text-[11px] text-slate-500">
                    {item.sub}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-semibold text-ink tabular-nums">
                  {Number(item.count).toLocaleString("en-US")}
                </span>
                {item.to && (
                  <Link
                    to={item.to}
                    className="mt-1 inline-flex items-center rounded-lg border border-navy/15 px-2 py-1 text-[10px] font-semibold text-ink transition-colors hover:bg-navy hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
                  >
                    {item.actionLabel ?? "View details"}
                    <span className="sr-only"> for {item.label}</span>
                  </Link>
                )}
                {!item.to && item.onClick && (
                  <button
                    type="button"
                    onClick={item.onClick}
                    className="mt-1 inline-flex items-center rounded-lg border border-navy/15 px-2 py-1 text-[10px] font-semibold text-ink transition-colors hover:bg-navy hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
                  >
                    {item.actionLabel ?? "View details"}
                    <span className="sr-only"> for {item.label}</span>
                  </button>
                )}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-accent-strong/70"
                style={{ width: `${(Number(item.count) / max) * 100}%` }}
              />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
