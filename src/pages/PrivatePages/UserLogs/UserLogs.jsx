// User logs (admin only): every recorded action by every person, with
// numbered pages and filters. Reads lirc_activity_log_page.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { WorkspaceHeader } from "../../../components/attendance/WorkspaceUi.jsx";
import { secondaryButton } from "../../../components/attendance/WorkspaceUi.jsx";
import { useActivityLog } from "../../../hooks/personnel/useActivityLog.js";
import {
  activityLink,
  sourceLabel,
  actorKindLabel,
  ACTIVITY_GROUPS,
  filterToParams,
} from "../../../services/personnel/describeActivity.js";
import { displayTime } from "../../../services/attendance/attendanceRules.js";
import { manilaInputToIso } from "../../../services/borrow/loanRules.js";
import { inputClass } from "../../../components/attendance/StaffUi.jsx";
import { ROLE_LABELS } from "../../../routes/roles.js";
import { chipClass } from "../../../components/personnel/panel.js";
import EmptyState from "../../../components/personnel/EmptyState.jsx";
import { Spinner } from "../../../components/ui/Loading.jsx";

const ROLE_OPTIONS = [
  ["", "All roles"],
  ["admin", "Admin"],
  ["librarian", "Librarian"],
  ["staff", "Staff"],
  ["faculty", "Faculty"],
  ["student", "Student"],
  ["non_teaching_personnel", "Non-teaching personnel"],
];

const SOURCE_OPTIONS = [
  ["", "All sources"],
  ["app", "In the app — someone used a screen"],
  ["auto", "Automatic follow-up — the system did it by itself"],
  ["direct_table", "Direct table edit — changed outside the app screens"],
  ["migration", "Migration — from setup or repair scripts"],
];

const SOURCE_TONES = {
  app: "bg-[#E7F4EF] text-[#0B6B52]",
  auto: "bg-slate-100 text-slate-600",
  direct_table: "bg-amber-50 text-amber-800",
  migration: "bg-slate-100 text-slate-600",
  import: "bg-[#F0EDFA] text-[#3B4A86]",
  system: "bg-slate-100 text-slate-600",
};

const selectClass =
  "rounded-xl border border-slate-400 bg-white px-3 py-2 text-xs text-[#0B1330] focus:border-[#3B4A86] focus:outline-none focus:ring-2 focus:ring-[#3B4A86]/15";

export default function UserLogs() {
  const [filter, setFilter] = useState("");
  const [role, setRole] = useState("");
  const [source, setSource] = useState("");
  const [personInput, setPersonInput] = useState("");
  const [person, setPerson] = useState("");
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [page, setPage] = useState(1);

  // Debounce the person search so typing does not refetch on every key.
  useEffect(() => {
    if (personInput === person) return;
    const timer = setTimeout(() => {
      setPerson(personInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [personInput, person]);

  const filters = useMemo(() => {
    const value = {};
    Object.assign(value, filterToParams(filter));
    if (role) value.actor_role = role;
    if (source) value.source = source;
    const search = person.trim();
    if (search) value.actor_search = search;
    const fromIso = manilaInputToIso(fromInput);
    if (fromIso) value.from_occurred_at = fromIso;
    const toIso = manilaInputToIso(toInput);
    if (toIso) value.to_occurred_at = toIso;
    return value;
  }, [filter, role, source, person, fromInput, toInput]);

  const log = useActivityLog({ filters, page, pageSize: 25 });

  function changeFilter(setter, value) {
    setter(value);
    setPage(1);
  }

  function goTo(nextPage) {
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-6">
      <WorkspaceHeader
        title="User logs"
        description="Every recorded action in the library system — who did it, what changed and when."
      >
        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white">
          Admin only
        </span>
      </WorkspaceHeader>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(11,19,48,0.05)] sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">Show:</span>
          {ACTIVITY_GROUPS.map((item) => (
            <button
              key={item.id || "all"}
              type="button"
              title={item.description}
              aria-pressed={filter === item.id}
              onClick={() => changeFilter(setFilter, item.id)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                filter === item.id
                  ? "bg-[#0B1330] text-white"
                  : "border border-slate-400 bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="text-xs text-slate-600">
            <span className="sr-only">Search a person by name</span>
            <input
              type="search"
              className={`${inputClass} w-64 max-w-full`}
              placeholder="Search a person by name…"
              value={personInput}
              onChange={(event) => setPersonInput(event.target.value)}
            />
          </label>
          <label className="text-xs text-slate-600">
            <span className="sr-only">Filter by role</span>
            <select
              className={selectClass}
              value={role}
              onChange={(event) => changeFilter(setRole, event.target.value)}
            >
              {ROLE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600">
            <span className="sr-only">Filter by source</span>
            <select
              className={selectClass}
              value={source}
              onChange={(event) => changeFilter(setSource, event.target.value)}
            >
              {SOURCE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-600">
            <span className="mb-1 block font-medium">From (Manila time)</span>
            <input
              type="datetime-local"
              className={selectClass}
              value={fromInput}
              onChange={(event) => {
                setFromInput(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="text-xs text-slate-600">
            <span className="mb-1 block font-medium">To (Manila time)</span>
            <input
              type="datetime-local"
              className={selectClass}
              value={toInput}
              onChange={(event) => {
                setToInput(event.target.value);
                setPage(1);
              }}
            />
          </label>
          {(filter || role || source || personInput || fromInput || toInput) && (
            <button
              type="button"
              className="text-[11px] font-semibold text-[#3B4A86] hover:underline"
              onClick={() => {
                setFilter("");
                setRole("");
                setSource("");
                setPersonInput("");
                setPerson("");
                setFromInput("");
                setToInput("");
                setPage(1);
              }}
            >
              Clear filters
            </button>
          )}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
          <strong className="font-semibold text-slate-600">Show</strong> — the
          kind of work recorded (hover a chip to see exactly what it covers).{" "}
          <strong className="font-semibold text-slate-600">Person</strong> —
          type a name; word order does not matter and close spellings are
          matched.{" "}
          <strong className="font-semibold text-slate-600">When</strong> —
          limit to a date and time range (Philippine time; blank means
          everything).{" "}
          <strong className="font-semibold text-slate-600">Who</strong> — the
          role of the person who did it.{" "}
          <strong className="font-semibold text-slate-600">Source</strong> —
          how the change happened: on a screen, by the system itself, outside
          the app screens, or from setup scripts.
        </p>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(11,19,48,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[#0B1330]">
            <span aria-hidden="true" className="h-4 w-1 rounded-full bg-[#0B1330]" />
            All activity
          </h2>
          {log.loading ? (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Spinner size="sm" /> Loading logs…
            </div>
          ) : (
            <span className="text-xs text-slate-500 tabular-nums">
              {log.total.toLocaleString("en-US")} log
              {log.total === 1 ? "" : "s"} · page {page} of {log.pages}
            </span>
          )}
        </div>

        {log.error && (
          <p role="alert" className="px-5 pb-3 text-xs text-red-700">
            {log.error}
          </p>
        )}

        <div className="hidden grid-cols-[150px_190px_1fr_120px_70px] gap-x-4 border-y border-slate-200 bg-[#F7F6FB] px-5 py-2.5 text-[11px] font-semibold text-slate-600 md:grid">
          <span>Time</span>
          <span>Who</span>
          <span>Action</span>
          <span>Source</span>
          <span />
        </div>

        {!log.loading && log.rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No logs match these filters"
              description="Try a different filter or clear them to see every recorded action."
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {log.rows.map((row) => {
              const route = activityLink(row);
              const roleLabel =
                ROLE_LABELS[row.actor_role] ??
                actorKindLabel(row.actor_kind);
              return (
                <li
                  key={row.id}
                  className="grid grid-cols-1 gap-x-4 gap-y-1 px-5 py-3.5 text-xs md:grid-cols-[150px_190px_1fr_120px_70px] md:items-center"
                >
                  <span className="text-slate-500">
                    {displayTime(row.occurred_at)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-[#0B1330]">
                      {row.actor_name ?? "Unattributed"}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {roleLabel}
                    </span>
                  </span>
                  <span className="min-w-0 leading-snug text-[#0B1330]">
                    {row.description}
                  </span>
                  <span
                    className={`${chipClass} w-fit ${SOURCE_TONES[row.source] ?? "bg-slate-100 text-slate-600"}`}
                  >
                    {sourceLabel(row.source)}
                  </span>
                  <span className="md:text-right">
                    {route && (
                      <Link
                        to={route}
                        className="text-[11px] font-semibold text-[#3B4A86] hover:underline"
                      >
                        Open
                      </Link>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
          <p className="text-xs text-slate-500">
            Showing page {page} of {log.pages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className={secondaryButton}
              disabled={log.loading || !log.hasPrev}
              onClick={() => goTo(Math.max(1, page - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className={secondaryButton}
              disabled={log.loading || !log.hasNext}
              onClick={() => goTo(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
