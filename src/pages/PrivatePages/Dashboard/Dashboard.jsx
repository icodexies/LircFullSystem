import { useEffect, useId, useState } from "react";
import { getMyFines } from "../../../services/fines/finesService.js";
import { peso } from "../../../services/fines/fineRules.js";
import { useAuth } from "../../../hooks/auth/useAuth.js";
import { ACCESS, ROLE_LABELS } from "../../../routes/roles.js";
import { WorkspaceHeader } from "../../../components/attendance/WorkspaceUi.jsx";
import {
  manilaGreeting,
  manilaLongDate,
} from "../../../services/dashboard/dashboardRules.js";
import PersonnelDashboard from "../../../components/personnel/PersonnelDashboard.jsx";

/* ------------------------------------------------------------------ */
/*  Design tokens (LIRC): navy #0B1330, sky-400 #38BDF8, slate surfaces */
/* ------------------------------------------------------------------ */
const NAVY = "#0B1330";
const SKY = "#38BDF8";

/* ------------------------------------------------------------------ */
/*  Icons (Tabler outline paths)                                       */
/* ------------------------------------------------------------------ */
const ICONS = {
  book: ["M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0", "M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0", "M3 6l0 13", "M12 6l0 13", "M21 6l0 13"],
  activity: ["M3 12h4l3 8l4 -16l3 8h4"],
  plus: ["M12 5l0 14", "M5 12l14 0"],
  edit: ["M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1", "M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415z", "M16 5l3 3"],
  exchange: ["M7 10h14l-4 -4", "M17 14h-14l4 4"],
  alert: ["M12 9v4", "M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z", "M12 16h.01"],
  coin: ["M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0", "M14.8 9a2 2 0 0 0 -1.8 -1h-2a2 2 0 1 0 0 4h2a2 2 0 1 1 0 4h-2a2 2 0 0 1 -1.8 -1", "M12 6v2m0 8v2"],
  clock: ["M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0", "M12 7v5l3 3"],
  up: ["M3 17l6 -6l4 4l8 -8", "M14 7l7 0l0 7"],
  down: ["M3 7l6 6l4 -4l8 8", "M21 10l0 7l-7 0"],
  door: ["M13 12v.01", "M3 21h18", "M5 21v-16a2 2 0 0 1 2 -2h6m4 10.5v7.5", "M21 7h-7m3 -3l-3 3l3 3"],
  world: ["M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0", "M3.6 9h16.8", "M3.6 15h16.8", "M11.5 3a17 17 0 0 0 0 18", "M12.5 3a17 17 0 0 1 0 18"],
  check: ["M5 12l5 5l10 -10"],
};

function Icon({ name, className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {ICONS[name].map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Hardcoded sample data: student and faculty                         */
/* ------------------------------------------------------------------ */
const MEMBER_DATA = {
  student: {
    limit: 5,
    stats: [
      { id: "borrowed", icon: "book", label: "Currently borrowed", value: "3", of: 5, hint: "of 5 books allowed" },
      { id: "dueSoon", icon: "clock", label: "Due within 3 days", value: "1", hint: "Database System Concepts" },
      { id: "overdue", icon: "alert", label: "Overdue", value: "1", hint: "Return it to stop fines", warn: true },
      { id: "fines", icon: "coin", label: "Outstanding fines", value: "₱30.00", hint: "Pay at the circulation desk" },
      { id: "visits", icon: "door", label: "Library visits", value: "18", hint: "This semester" },
    ],
    borrowed: [
      { title: "Introduction to Algorithms", author: "Cormen, Leiserson, Rivest, Stein", call: "QA76.6 .I5858", due: "Oct 5", daysLeft: -2, loanDays: 7 },
      { title: "Database System Concepts", author: "Silberschatz, Korth, Sudarshan", call: "QA76.9.D3 S55", due: "Oct 9", daysLeft: 2, loanDays: 7 },
      { title: "Clean Code", author: "Robert C. Martin", call: "QA76.76.D47 M37", due: "Oct 21", daysLeft: 14, loanDays: 14 },
    ],
    visits: [1, 2, 3, 2, 1, 3, 2, 1, 2, 1],
    genres: [
      { label: "Computer Science", value: 9, color: "var(--chart-dash-1)" },
      { label: "Mathematics", value: 4, color: "var(--chart-dash-2)" },
      { label: "General Education", value: 3, color: "var(--chart-dash-3)" },
      { label: "Fiction", value: 2, color: "var(--chart-dash-4)" },
    ],
    activity: [
      { text: "Checked in at the library entrance", time: "Today, 7:52 AM" },
      { text: "Renewed Database System Concepts", time: "Oct 2" },
      { text: "Borrowed Clean Code", time: "Oct 7" },
    ],
  },
  faculty: {
    limit: 10,
    stats: [
      { id: "borrowed", icon: "book", label: "Currently borrowed", value: "4", of: 10, hint: "of 10 books allowed" },
      { id: "dueSoon", icon: "clock", label: "Due within 3 days", value: "1", hint: "Research Methods in Computing" },
      { id: "overdue", icon: "alert", label: "Overdue", value: "0", hint: "Nothing to return right now" },
      { id: "fines", icon: "coin", label: "Outstanding fines", value: "₱0.00", hint: "You are all settled" },
      { id: "visits", icon: "door", label: "Library visits", value: "31", hint: "This semester" },
    ],
    borrowed: [
      { title: "Research Methods in Computing", author: "Dawson, C.", call: "QA76 .D39", due: "Oct 9", daysLeft: 2, loanDays: 30 },
      { title: "Teaching Programming", author: "Hazzan, Lapidot, Ragonis", call: "QA76.27 .H39", due: "Oct 28", daysLeft: 21, loanDays: 30 },
      { title: "Software Architecture in Practice", author: "Bass, Clements, Kazman", call: "QA76.758 .B37", due: "Nov 3", daysLeft: 27, loanDays: 30 },
      { title: "Applied Statistics for IT", author: "Montgomery, D.", call: "QA276 .M66", due: "Nov 6", daysLeft: 30, loanDays: 30 },
    ],
    visits: [3, 4, 3, 4, 2, 4, 3, 3, 3, 2],
    genres: [
      { label: "Computer Science", value: 7, color: "var(--chart-dash-1)" },
      { label: "Education", value: 5, color: "var(--chart-dash-2)" },
      { label: "Statistics", value: 3, color: "var(--chart-dash-3)" },
      { label: "Journals", value: 2, color: "var(--chart-dash-4)" },
    ],
    activity: [
      { text: "Checked in at the library entrance", time: "Today, 7:40 AM" },
      { text: "Borrowed Applied Statistics for IT", time: "Oct 7" },
      { text: "Renewed Teaching Programming", time: "Oct 1" },
    ],
  },
};

const DIGITAL_RESOURCES = [
  { name: "VitalSource", note: "E-books for your courses", status: "Approved" },
  { name: "Philippine E-Journals", note: "Local research and journals", status: "Approved" },
  { name: "AccessScience", note: "Science and technology reference", status: "Pending approval" },
];

const WEEKLY_VISIT_LABELS = ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8", "W9", "W10"];

/* ------------------------------------------------------------------ */
/*  Small helpers                                                      */
/* ------------------------------------------------------------------ */
function smoothPath(pts) {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

function niceTop(max) {
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const step = Math.max(1, magnitude / 2);
  const top = Math.ceil(max / step) * step;
  return Math.ceil(top / 4) * 4;
}

const fmt = (n) => n.toLocaleString("en-US");

/* ------------------------------------------------------------------ */
/*  Shared UI pieces                                                   */
/* ------------------------------------------------------------------ */
function Card({ title, subtitle, action, children, className = "" }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-surface p-5 shadow-[0_1px_2px_rgba(11,19,48,0.05)] sm:p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg font-semibold tracking-tight text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function DashboardHero({ role }) {
  const { profile } = useAuth();
  const firstName = profile?.first_name ? `, ${profile.first_name}` : "";
  return (
    <WorkspaceHeader
      title={`${manilaGreeting()}${firstName}`}
      description="Here's what's happening in the library today."
    >
      <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white">
        {ROLE_LABELS[role] ?? "Member"} account
      </span>
      <span>{manilaLongDate()}</span>
    </WorkspaceHeader>
  );
}

function AreaChart({ labels, data, unit }) {
  const gid = useId().replace(/:/g, "");
  const W = 600;
  const H = 240;
  const pl = 40;
  const pr = 14;
  const pt = 22;
  const pb = 30;
  const peak = data.indexOf(Math.max(...data));
  const [hover, setHover] = useState(null);
  const active = hover ?? peak;
  const top = niceTop(Math.max(...data));
  const step = (W - pl - pr) / (data.length - 1);
  const x = (i) => pl + i * step;
  const y = (v) => pt + (1 - v / top) * (H - pt - pb);
  const pts = data.map((v, i) => [x(i), y(v)]);
  const line = smoothPath(pts);
  const area = `${line} L${x(data.length - 1)},${H - pb} L${x(0)},${H - pb} Z`;
  const tw = 96;
  const tx = Math.min(Math.max(x(active) - tw / 2, pl), W - pr - tw);
  const ty = y(data[active]) - 58 < 2 ? y(data[active]) + 14 : y(data[active]) - 58;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${unit} per period chart`} onMouseLeave={() => setHover(null)}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={SKY} stopOpacity="0.35" />
          <stop offset="100%" stopColor={SKY} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3, 4].map((i) => {
        const v = (top / 4) * i;
        return (
          <g key={i}>
            <line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} className="stroke-slate-200" strokeDasharray={i === 0 ? "0" : "4 4"} />
            <text x={pl - 8} y={y(v) + 4} textAnchor="end" fontSize="11" className="fill-slate-400">{fmt(Math.round(v))}</text>
          </g>
        );
      })}
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" style={{ stroke: "var(--chart-1)" }} strokeWidth="2.5" strokeLinecap="round" />
      {labels.map((l, i) => (
        <text key={l} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" className="fill-slate-400" style={i === active ? { fill: "var(--chart-1)" } : undefined} fontWeight={i === active ? 600 : 400}>{l}</text>
      ))}
      <line x1={x(active)} x2={x(active)} y1={y(data[active])} y2={H - pb} stroke={SKY} strokeWidth="1.5" strokeDasharray="3 3" />
      <circle cx={x(active)} cy={y(data[active])} r="6" style={{ fill: "var(--color-surface)", stroke: "var(--chart-1)" }} strokeWidth="3" />
      <g transform={`translate(${tx},${ty})`}>
        <rect width={tw} height="44" rx="10" fill={NAVY} />
        <text x={tw / 2} y="19" textAnchor="middle" fontSize="14" fontWeight="700" fill="white">{fmt(data[active])} {unit}</text>
        <text x={tw / 2} y="35" textAnchor="middle" fontSize="11" fill="#94A3B8">{labels[active]}</text>
      </g>
      {data.map((_, i) => (
        <rect key={i} x={x(i) - step / 2} y={0} width={step} height={H - pb} fill="transparent" tabIndex={0} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onClick={() => setHover(i)} aria-label={`${labels[i]}: ${data[i]} ${unit}`} className="outline-none" />
      ))}
    </svg>
  );
}

function Donut({ segments, centerValue, centerLabel }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const arcs = segments.reduce((rows, segment) => {
    const percent = total > 0 ? (segment.value / total) * 100 : 0;
    const previous = rows.at(-1);
    return [...rows, { ...segment, percent, offset: previous ? previous.offset + previous.percent : 0 }];
  }, []);
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row xl:flex-col">
      <div className="relative h-44 w-44 shrink-0">
        <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90" role="img" aria-label={centerLabel}>
          <circle cx="21" cy="21" r="15.9155" fill="none" className="stroke-slate-100" strokeWidth="5" />
          {arcs.map((arc) => (
            <circle key={arc.label} cx="21" cy="21" r="15.9155" fill="none" style={{ stroke: arc.color }} strokeWidth="5" strokeDasharray={`${Math.max(arc.percent - 0.8, 0)} ${100 - arc.percent + 0.8}`} strokeDashoffset={-arc.offset} />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-serif text-3xl font-bold text-ink">{centerValue}</span>
          <span className="text-xs text-slate-500">{centerLabel}</span>
        </div>
      </div>
      <ul className="w-full space-y-2.5">
        {segments.map((seg) => (
          <li key={seg.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: seg.color }} aria-hidden="true" />
              {seg.label}
            </span>
            <span className="font-medium text-ink">{fmt(seg.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProgressBar({ value, max, tone = "sky" }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const fill = tone === "rose" ? "bg-rose-400" : tone === "navy" ? "bg-navy dark:bg-accent-strong" : "bg-sky-400";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className={`h-full rounded-full ${fill}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dashboard for students and faculty                                 */
/* ------------------------------------------------------------------ */
function dueChip(daysLeft) {
  if (daysLeft < 0) return { text: `${Math.abs(daysLeft)} days overdue`, cls: "bg-rose-50 text-rose-700", tone: "rose" };
  if (daysLeft <= 3) return { text: daysLeft === 1 ? "Due in 1 day" : `Due in ${daysLeft} days`, cls: "bg-amber-50 text-amber-700", tone: "navy" };
  return { text: `${daysLeft} days left`, cls: "bg-sky-50 text-sky-700", tone: "sky" };
}

function MemberDashboard({ role }) {
  const data = MEMBER_DATA[role];
  const visitsTotal = data.visits.reduce((a, b) => a + b, 0);
  const [myFines, setMyFines] = useState(null);

  // The fines card follows the real balance (and the setting).
  useEffect(() => {
    let active = true;
    getMyFines()
      .then((result) => {
        if (active) setMyFines(result);
      })
      .catch(() => {
        if (active) setMyFines(null);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <DashboardHero role={role} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.stats.map((s, i) => {
          const stat =
            s.id === "fines" && myFines?.enabled
              ? {
                  ...s,
                  value: peso(myFines.unpaid_total),
                  hint:
                    Number(myFines.unpaid_total) > 0
                      ? "Please settle at the library counter"
                      : "You are all settled",
                  warn: Number(myFines.unpaid_total) > 0,
                }
              : s;
          const featured = i === 0;
          return (
            <div key={stat.id} className={`flex min-w-0 flex-col rounded-2xl border p-5 shadow-[0_1px_2px_rgba(11,19,48,0.05)] ${featured ? "border-navy bg-navy text-white" : "border-slate-200 bg-surface text-ink"}`}>
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${featured ? "bg-white/10 text-sky-300" : stat.warn ? "bg-rose-50 text-rose-600" : "bg-tint text-accent"}`}>
                <Icon name={stat.icon} className="h-[18px] w-[18px]" />
              </span>
              <p className={`mt-5 text-[13px] ${featured ? "text-slate-300" : "text-slate-500"}`}>{stat.label}</p>
              <p className="mt-1 font-serif text-3xl font-bold tracking-tight">{stat.value}</p>
              {stat.of ? (
                <div className="mt-3">
                  <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-white/15">
                    <div className="h-full rounded-full bg-sky-300" style={{ width: `${(Number(stat.value) / stat.of) * 100}%` }} />
                  </div>
                  <p className="text-xs text-slate-400">{stat.hint}</p>
                </div>
              ) : (
                <p className={`mt-2 text-xs ${stat.warn ? "text-rose-600" : "text-slate-500"}`}>{stat.hint}</p>
              )}
            </div>
          );
        })}
      </div>

      <Card title="Books you have borrowed" subtitle="Return or renew before the due date to avoid fines">
          <ul className="space-y-3">
            {data.borrowed.map((b) => {
              const chip = dueChip(b.daysLeft);
              const used = Math.min(b.loanDays, Math.max(0, b.loanDays - b.daysLeft));
              return (
                <li key={b.title} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:gap-5">
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <span className="flex h-14 w-10 shrink-0 items-center justify-center rounded-md bg-navy text-sky-300" aria-hidden="true">
                      <Icon name="book" className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{b.title}</p>
                      <p className="truncate text-xs text-slate-500">{b.author}</p>
                      <p className="mt-0.5 text-xs text-slate-400">Call number {b.call}</p>
                    </div>
                  </div>
                  <div className="sm:w-52">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-500">Due {b.due}</span>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${chip.cls}`}>{chip.text}</span>
                    </div>
                    <ProgressBar value={used} max={b.loanDays} tone={chip.tone} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Your library visits" subtitle={`${visitsTotal} visits over the last 10 weeks`}>
          <AreaChart labels={WEEKLY_VISIT_LABELS} data={data.visits} unit="visits" />
        </Card>
        <Card title="What you read" subtitle="Borrowed books by category">
          <Donut segments={data.genres} centerValue={String(data.genres.reduce((s, g) => s + g.value, 0))} centerLabel="books" />
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Recent activity">
          <ol className="relative space-y-5 border-l border-slate-200 pl-6">
            {data.activity.map((a) => (
              <li key={a.text} className="relative">
                <span className="absolute -left-[29px] top-1 h-2.5 w-2.5 rounded-full bg-sky-400 ring-4 ring-white" aria-hidden="true" />
                <p className="text-sm text-ink">{a.text}</p>
                <p className="text-xs text-slate-500">{a.time}</p>
              </li>
            ))}
          </ol>
        </Card>

        <Card title="Digital resources" subtitle="Access is approved by the library admin">
          <ul className="space-y-3">
            {DIGITAL_RESOURCES.map((r) => {
              const approved = r.status === "Approved";
              return (
                <li key={r.name} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy text-sky-300">
                    <Icon name="world" className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{r.name}</p>
                    <p className="truncate text-xs text-slate-500">{r.note}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${approved ? "bg-sky-50 text-sky-700" : "bg-amber-50 text-amber-700"}`}>{r.status}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page: shows the right dashboard for the signed-in role             */
/* ------------------------------------------------------------------ */
export default function Dashboard() {
  const { role } = useAuth();
  if (ACCESS.staff.includes(role)) return <PersonnelDashboard role={role} />;
  return <MemberDashboard role={role === "faculty" ? "faculty" : "student"} />;
}
