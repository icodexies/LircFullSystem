// Attendance station: pick the purpose, scan or type the library card, and
// the visit is recorded — a time in for someone arriving, a time out for
// someone already inside (the same rule as the desk scanner). A small list
// shows the latest visits; the full records with filters stay with the
// staff, librarian and admin pages.
import { useEffect, useRef, useState } from "react";
import {
  systemAttendance,
  systemAttendanceRecent,
} from "../../services/system/systemStationService.js";
import {
  PURPOSES,
  displayTime,
} from "../../services/attendance/attendanceRules.js";
import { Spinner } from "../../components/ui/Loading.jsx";
import { SkeletonRows } from "../../components/ui/Skeleton.jsx";

const inputCls =
  "w-full rounded-xl border border-slate-400 bg-surface px-4 py-3.5 text-base text-ink placeholder:text-slate-500 focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/15";

export default function AttendanceStation() {
  const [purpose, setPurpose] = useState("Study");
  const [card, setCard] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { ok, visit } | { error }
  const [recent, setRecent] = useState({ key: "", rows: [] });
  const [revision, setRevision] = useState(0);
  const cardRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    systemAttendanceRecent(controller.signal)
      .then((rows) => {
        if (active) setRecent({ key: String(revision), rows });
      })
      .catch(() => {
        // The list is a convenience; scanning still works without it.
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [revision]);

  const loadingRecent = recent.key !== String(revision) && !recent.rows.length;

  async function submit() {
    if (busy) return;
    if (!card.trim()) {
      setResult({ error: "Scan or type the library card." });
      return;
    }
    setBusy(true);
    try {
      const visit = await systemAttendance(card.trim(), purpose);
      setResult({ ok: true, visit });
      setCard("");
      setRevision((value) => value + 1);
      cardRef.current?.focus();
    } catch (error) {
      setResult({ error: error.message });
    } finally {
      setBusy(false);
    }
  }

  function onKey(event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void submit();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-[0_1px_2px_rgba(11,19,48,0.05)] sm:p-6">
        <h2 className="font-serif text-lg font-semibold tracking-tight text-ink">
          Record a visit
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Pick the purpose, then scan or type the library card and press Enter.
          Someone still inside gets a time out instead.
        </p>

        <div className="mt-5">
          <p className="mb-2 text-[11px] font-semibold text-slate-600">
            Purpose of the visit
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Purpose of the visit">
            {PURPOSES.map((value) => (
              <button
                key={value}
                type="button"
                disabled={busy}
                aria-pressed={purpose === value}
                onClick={() => {
                  setPurpose(value);
                  cardRef.current?.focus();
                }}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong disabled:opacity-60 ${
                  purpose === value
                    ? "bg-sky-400 text-navy shadow-[0_4px_14px_rgba(56,189,248,0.45)] ring-2 ring-sky-300"
                    : "border border-slate-400 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-ink"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            The highlighted purpose is saved with every time in until you
            change it.
          </p>
        </div>

        <label className="mt-5 block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-600">
            Library card
          </span>
          <input
            ref={cardRef}
            className={inputCls}
            value={card}
            onChange={(event) => setCard(event.target.value)}
            onKeyDown={onKey}
            autoFocus
            autoComplete="off"
            placeholder="Scan or type the card…"
            aria-label="Library card number"
          />
        </label>

        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-navy px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong disabled:opacity-50 sm:w-auto"
        >
          {busy && <Spinner size="sm" />}
          {busy ? "Recording…" : "Record visit"}
        </button>

        {result?.ok && (
          <div
            role="status"
            className={`mt-5 rounded-xl border px-4 py-3.5 text-sm ${
              result.visit.action === "in"
                ? "border-jade/30 bg-jade-soft text-jade-deep"
                : "border-sky-300/60 bg-sky-50 text-sky-700"
            }`}
          >
            <p className="font-semibold">
              {result.visit.action === "in"
                ? "Time in recorded ✓"
                : "Time out recorded ✓"}
            </p>
            <p className="mt-1 text-xs leading-relaxed">
              {result.visit.member_name} ({result.visit.library_id}) ·{" "}
              {displayTime(result.visit.at)}
              {result.visit.purpose ? ` · ${result.visit.purpose}` : ""}
            </p>
          </div>
        )}
        {result?.error && (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3.5 text-sm font-medium text-red-700"
          >
            {result.error}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-[0_1px_2px_rgba(11,19,48,0.05)] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg font-semibold tracking-tight text-ink">
              Recent visits
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              The last 10 visits recorded in the library.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRevision((value) => value + 1)}
            className="rounded-xl border border-slate-400 bg-slate-100 px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
          >
            Refresh
          </button>
        </div>

        {loadingRecent ? (
          <div className="mt-4">
            <SkeletonRows count={3} label="Loading the recent visits…" />
          </div>
        ) : recent.rows.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-page/60 px-4 py-6 text-center text-xs text-slate-500">
            No visits recorded yet — the first scan will appear in this list.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {recent.rows.map((visit) => (
              <li
                key={visit.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 text-xs"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">
                    {visit.member_name}
                    {visit.library_id ? ` (${visit.library_id})` : ""}
                  </p>
                  <p className="mt-0.5 text-slate-500">
                    {visit.purpose || "Purpose not recorded"}
                    {visit.time_out
                      ? ` · out ${displayTime(visit.time_out)}`
                      : ""}
                  </p>
                </div>
                <span className="flex items-center gap-2 text-[11px] text-slate-400">
                  in {displayTime(visit.time_in)}
                  {visit.is_open && (
                    <span className="rounded-full bg-jade-soft px-2 py-0.5 text-[10px] font-semibold text-jade-deep">
                      Inside now
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
