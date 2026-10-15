// The two dashboard charts. Both render server-computed numbers only:
//   DailyBars — your actions per day (30-day window, today highlighted)
//   WorkDonut — where your work goes, by kind, with counts and shares
import { useState } from "react";
import {
  barSeries,
  donutSegments,
  shortDay,
} from "../../services/personnel/personnelRules.js";

export function DailyBars({ daily }) {
  const { bars } = barSeries(daily);
  const [hover, setHover] = useState(null);
  if (bars.length === 0) return null;
  const today = bars[bars.length - 1].day;
  const first = bars[0].day;
  const middle = bars[Math.floor(bars.length / 2)].day;
  const active = hover === null ? null : bars[hover];
  const leftPct =
    hover === null
      ? 0
      : Math.min(92, Math.max(8, ((hover + 0.5) / bars.length) * 100));

  return (
    <div>
      <div className="relative">
        {active && (
          <div
            role="status"
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg bg-navy px-2.5 py-1.5 text-center shadow-[0_4px_12px_rgba(11,19,48,0.25)]"
            style={{
              left: `${leftPct}%`,
              bottom: `calc(${active.pct}% + 12px)`,
            }}
          >
            <span className="block text-[11px] font-bold leading-tight text-white tabular-nums">
              {active.count} {active.count === 1 ? "action" : "actions"}
            </span>
            <span className="mt-0.5 block text-[10px] leading-tight text-slate-300">
              {shortDay(active.day)}
            </span>
            <span
              aria-hidden="true"
              className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 rounded-[2px] bg-navy"
            />
          </div>
        )}
        <div
          className="flex h-40 items-end gap-[3px]"
          role="img"
          aria-label={`Actions per day from ${shortDay(first)} to ${shortDay(today)}`}
        >
          {bars.map((bar, index) => (
            <div
              key={bar.day}
              tabIndex={0}
              aria-label={`${shortDay(bar.day)}: ${bar.count} action${bar.count === 1 ? "" : "s"}`}
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(index)}
              onBlur={() => setHover(null)}
              className={`min-w-0 flex-1 rounded-t-sm transition-opacity duration-150 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong ${
                bar.count === 0
                  ? "bg-slate-200"
                  : bar.day === today
                    ? "bg-jade"
                    : "bg-navy/75"
              }`}
              style={{ height: bar.count > 0 ? `${bar.pct}%` : "3px" }}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-slate-500">
          <span>{shortDay(first)}</span>
          <span className="hidden sm:inline">{shortDay(middle)}</span>
          <span>Today · {shortDay(today)}</span>
        </div>
      </div>
    </div>
  );
}

export function WorkDonut({ groups }) {
  const segments = donutSegments(groups);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const arcs = segments.reduce((rows, segment) => {
    const previous = rows.at(-1);
    return [
      ...rows,
      {
        ...segment,
        offset: previous ? previous.offset + previous.pct : 0,
      },
    ];
  }, []);

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative h-40 w-40 shrink-0">
        <svg
          viewBox="0 0 42 42"
          className="h-full w-full -rotate-90"
          role="img"
          aria-label="Your actions by kind"
        >
          <circle
            cx="21"
            cy="21"
            r="15.9155"
            fill="none"
            stroke="#F1F5F9"
            strokeWidth="5"
          />
          {arcs.map((arc) => (
            <circle
              key={arc.key}
              cx="21"
              cy="21"
              r="15.9155"
              fill="none"
              stroke={arc.color}
              strokeWidth="5"
              strokeDasharray={`${Math.max(arc.pct - 0.8, 0)} ${100 - arc.pct + 0.8}`}
              strokeDashoffset={-arc.offset}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-serif text-3xl font-bold tracking-tight text-ink tabular-nums">
            {total.toLocaleString("en-US")}
          </span>
          <span className="text-xs text-slate-500">actions</span>
        </div>
      </div>
      <ul className="w-full space-y-2">
        {segments.map((segment) => (
          <li
            key={segment.key}
            className="flex items-center justify-between gap-3 text-xs"
          >
            <span className="flex min-w-0 items-center gap-2 text-slate-600">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: segment.color }}
                aria-hidden="true"
              />
              <span className="truncate">{segment.label}</span>
            </span>
            <span className="shrink-0 text-ink tabular-nums">
              {segment.value.toLocaleString("en-US")}{" "}
              <span className="text-slate-500">({segment.pct}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
