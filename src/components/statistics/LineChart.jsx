// LineChart — a small multi-series SVG line chart with a hover guide and a
// tooltip. Server-computed numbers only; labels are short strings (months).
import { useState } from "react";

const W = 640;
const H = 220;
const PAD = { top: 18, right: 14, bottom: 26, left: 40 };

const number = (value) => Number(value ?? 0).toLocaleString("en-US");

export default function LineChart({ labels, series, unit = "" }) {
  const [hover, setHover] = useState(null);
  if (!labels || labels.length === 0) return null;

  const max = Math.max(1, ...series.flatMap((line) => line.values));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const stepX = plotW / Math.max(1, labels.length - 1);
  const x = (index) => PAD.left + index * stepX;
  const y = (value) => PAD.top + plotH - (value / max) * plotH;

  const ticks = [
    ...new Set([0, 0.25, 0.5, 0.75, 1].map((part) => Math.round(max * part))),
  ];
  const active = hover === null ? null : hover;

  return (
    <div className="relative">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        {series.map((line) => (
          <span key={line.key} className="flex items-center gap-1.5 text-[11px] text-slate-600">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: line.color }}
            />
            {line.label}
          </span>
        ))}
      </div>

      <div className="relative">
        {active !== null && (
          <div
            role="status"
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg bg-[#0B1330] px-3 py-2 shadow-[0_4px_12px_rgba(11,19,48,0.25)]"
            style={{
              left: `${Math.min(88, Math.max(12, (x(active) / W) * 100))}%`,
              bottom: `calc(${(1 - y(Math.max(...series.map((line) => line.values[active]))) / H) * 100}% + 12px)`,
            }}
          >
            <span className="block text-[11px] font-bold leading-tight text-white">
              {labels[active]}
            </span>
            {series.map((line) => (
              <span
                key={line.key}
                className="mt-0.5 flex items-center gap-1.5 text-[10px] leading-tight text-slate-300"
              >
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: line.color }}
                />
                {line.label}: {number(line.values[active])}
              </span>
            ))}
          </div>
        )}

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={`${series.map((line) => line.label).join(", ")} per month`}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke="#E2E8F0"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 6}
                y={y(tick) + 3}
                textAnchor="end"
                className="fill-slate-400"
                fontSize="9"
              >
                {number(tick)}
              </text>
            </g>
          ))}

          {series.map((line) => (
            <polyline
              key={line.key}
              points={line.values.map((value, index) => `${x(index)},${y(value)}`).join(" ")}
              fill="none"
              stroke={line.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {active !== null && (
            <line
              x1={x(active)}
              x2={x(active)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="#94A3B8"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          )}

          {active !== null &&
            series.map((line) => (
              <circle
                key={line.key}
                cx={x(active)}
                cy={y(line.values[active])}
                r="4"
                fill={line.color}
                stroke="#FFFFFF"
                strokeWidth="2"
              />
            ))}

          {labels.map((label, index) => {
            const show =
              index === 0 || index === labels.length - 1 || index === Math.floor(labels.length / 2);
            return show ? (
              <text
                key={label}
                x={x(index)}
                y={H - 8}
                textAnchor={index === 0 ? "start" : index === labels.length - 1 ? "end" : "middle"}
                className="fill-slate-400"
                fontSize="9"
              >
                {label}
              </text>
            ) : null;
          })}

          {labels.map((label, index) => (
            <rect
              key={`zone-${label}`}
              x={x(index) - stepX / 2}
              y={PAD.top}
              width={stepX}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(index)}
            />
          ))}
        </svg>
      </div>
      {unit && <p className="mt-1 text-[11px] text-slate-400">{unit}</p>}
    </div>
  );
}
