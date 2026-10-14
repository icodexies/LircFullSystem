// Scanner panel — one step: scan the card and the visit is recorded.
//
//   * The visitor is still inside (open visit) -> records a TIME OUT.
//   * No open visit -> records a TIME IN using the highlighted purpose.
//
// The purpose is picked once (like the inventory condition) and stays
// highlighted for every following scan until it is changed. After every card
// the field clears itself and the cursor returns to it, and the last result
// stays visible — so a whole queue can be scanned without touching anything
// else. A time-in is quietly re-checked against a fresh card read right
// before writing, and the database triggers guard the last race.
import { useEffect, useRef, useState } from "react";
import { useSemester } from "../../hooks/periods/useSemester.js";
import {
  lookupCard,
  recordTimeIn,
  recordTimeOut,
} from "../../services/attendance/attendanceService.js";
import {
  PURPOSES,
  displayTime,
  normalizeCard,
  personName,
  timeInReason,
} from "../../services/attendance/attendanceRules.js";
import { buttonClass, inputClass, Field } from "./StaffUi.jsx";
import { secondaryButton } from "./WorkspaceUi.jsx";
import { Spinner } from "../ui/Loading.jsx";

const DEFAULT_PURPOSE = "Reading";

const TONES = {
  success: "bg-[#E7F4EF] text-[#0B6B52]",
  warning: "bg-amber-50 text-amber-900",
  error: "bg-red-50 text-red-700",
};

export default function ScannerPanel({ onChanged, onClose, onBusy }) {
  const periods = useSemester();
  const [card, setCard] = useState("");
  const [purpose, setPurpose] = useState(DEFAULT_PURPOSE);
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  useEffect(() => {
    onBusy?.(busy);
  }, [busy, onBusy]);
  const [tabTerminator, setTabTerminator] = useState(false);
  const input = useRef(null);
  const lock = useRef(false);
  const mounted = useRef(true);
  const controller = useRef(null);
  useEffect(() => {
    mounted.current = true;
    input.current?.focus();
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  // Back to the card field after every card: cleared input -> plain focus,
  // failed card -> focused and selected so the next scan replaces it.
  useEffect(() => {
    if (busy) return;
    const field = input.current;
    field?.focus();
    if (field?.value) field.select();
  }, [busy]);

  // Enter or the button: look up the card, decide, and record in one step.
  async function record() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    try {
      const normalized = normalizeCard(card);
      const refreshed = await periods.refreshSemesters();
      if (!refreshed)
        throw new Error("Refresh academic periods before scanning.");
      const preview = await lookupCard(normalized, abort.signal);
      if (!mounted.current) return;

      // Already inside: record the time out. The purpose saved at time in
      // stays on the record; nothing is asked here.
      if (preview.open_visit) {
        await recordTimeOut(preview.open_visit.id);
        if (mounted.current) {
          setResult({
            tone: "success",
            text: `${personName(preview.profile)} — time out recorded · ${displayTime(new Date())}`,
          });
          setCard("");
          onChanged();
        }
        return;
      }

      // No open visit: this is a time in, so the purpose is required now.
      const blocked = timeInReason(
        preview,
        periods.selectedSemesterId,
        purpose,
        other,
      );
      if (blocked) {
        if (mounted.current) setResult({ tone: "warning", text: blocked });
        return;
      }

      // Read the card once more just before writing. A changed semester,
      // enrollment or visit means the staff scans the card again.
      const fresh = await lookupCard(normalized);
      const signature = (value) =>
        JSON.stringify([
          value.active_semester,
          value.enrollment,
          value.open_visit,
          value.profile,
        ]);
      if (signature(fresh) !== signature(preview))
        throw new Error("Something changed for this visitor. Scan the card again.");

      await recordTimeIn(
        fresh.profile.id,
        fresh.active_semester.id,
        purpose === "Other" ? other.trim() : purpose,
      );
      if (mounted.current) {
        setResult({
          tone: "success",
          text: `${personName(fresh.profile)} — time in recorded · ${
            purpose === "Other" ? other.trim() : purpose
          } · ${displayTime(new Date())}`,
        });
        setCard("");
        onChanged();
      }
    } catch (error) {
      if (mounted.current) setResult({ tone: "error", text: error.message });
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <section aria-label="Attendance scanner" className="space-y-4 p-6">
      <div>
        <p className="mb-2 text-[11px] font-semibold text-slate-600">
          Purpose of the visit
        </p>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Purpose of the visit"
        >
          {PURPOSES.map((value) => (
            <button
              key={value}
              type="button"
              disabled={busy}
              aria-pressed={purpose === value}
              onClick={() => {
                setPurpose(value);
                input.current?.focus();
              }}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B4A86] disabled:opacity-60 ${
                purpose === value
                  ? "bg-[#0B1330] text-white shadow-sm"
                  : "border border-slate-400 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-[#0B1330]"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          The highlighted purpose is saved with every time in until you change
          it. Someone still inside gets a time out instead — no purpose needed.
        </p>
      </div>

      {purpose === "Other" && (
        <Field label="Describe purpose">
          <input
            maxLength="250"
            className={inputClass}
            value={other}
            disabled={busy}
            onChange={(event) => setOther(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                input.current?.focus();
              }
            }}
          />
        </Field>
      )}

      <div className="max-w-xl">
        <Field label="Library card">
          <input
            ref={input}
            className={inputClass}
            value={card}
            disabled={busy}
            autoComplete="off"
            maxLength="124"
            placeholder="Scan or type the card…"
            onChange={(event) => setCard(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" ||
                (event.key === "Tab" && tabTerminator)
              ) {
                event.preventDefault();
                event.stopPropagation();
                if (!event.repeat) void record();
              }
            }}
          />
        </Field>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={tabTerminator}
          onChange={(event) => setTabTerminator(event.target.checked)}
          className="h-3.5 w-3.5 accent-[#0B1330]"
        />
        This scanner uses Tab as terminator
      </label>

      {result && (
        <div
          role="status"
          className={`rounded-xl p-3 text-xs leading-relaxed ${
            TONES[result.tone] ?? TONES.error
          }`}
        >
          {result.text}
        </div>
      )}
      {busy && (
        <div
          role="status"
          className="flex items-center gap-2 text-sm text-slate-600"
        >
          <Spinner size="sm" /> Processing…
        </div>
      )}
      <p className="text-xs text-slate-500">
        Scan or type the card, then press Enter — nothing else to review. The
        field clears itself after every card, so a whole queue can be scanned
        without touching anything else.
      </p>
      <div className="sticky bottom-0 -mx-6 -mb-6 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-gradient-to-r from-[#F7F6FB] to-white px-6 py-4">
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className={secondaryButton}
        >
          Close
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={record}
          className={buttonClass}
        >
          Record visit
        </button>
      </div>
    </section>
  );
}
