// Scanner panel — one step: scan the card and the visit is recorded.
//
//   * The visitor is still inside (open visit) -> records a TIME OUT.
//   * No open visit -> records a TIME IN using the chosen purpose.
//
// There is no separate look-up button and no preview screen; the system
// decides by itself. A time-in is quietly re-checked against a fresh card
// read right before writing, and the database triggers guard the last race.
import { useEffect, useRef, useState } from "react";
import { useSemester } from "../../hooks/periods/useSemester.js";
import {
  lookupCard,
  recordTimeIn,
  recordTimeOut,
} from "../../services/attendance/attendanceService.js";
import {
  PURPOSES,
  normalizeCard,
  timeInReason,
} from "../../services/attendance/attendanceRules.js";
import { buttonClass, inputClass, Field } from "./StaffUi.jsx";
import { secondaryButton } from "./WorkspaceUi.jsx";
import { Spinner } from "../ui/Loading.jsx";
import { useToast } from "../../hooks/shared/useToast.js";
export default function ScannerPanel({ onChanged, onClose, onBusy }) {
  const periods = useSemester();
  const toast = useToast();
  const [card, setCard] = useState("");
  const [purpose, setPurpose] = useState("");
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
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
  useEffect(() => {
    if (!busy) input.current?.focus();
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
          toast.success("Time out recorded.");
          setCard("");
          setPurpose("");
          setOther("");
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
      if (blocked) throw new Error(blocked);

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
        toast.success("Time in recorded.");
        setCard("");
        setPurpose("");
        setOther("");
        onChanged();
      }
    } catch (error) {
      if (mounted.current) toast.error(error.message, "Not recorded");
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section aria-label="Attendance scanner" className="space-y-4 p-6">
      <Field label="Library card">
        <input
          ref={input}
          className={inputClass}
          value={card}
          disabled={busy}
          autoComplete="off"
          maxLength="124"
          onChange={(event) => {
            setCard(event.target.value);
          }}
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
      <Field label="Purpose of the visit">
        <select
          className={inputClass}
          disabled={busy}
          value={purpose}
          onChange={(event) => {
            setPurpose(event.target.value);
            // Back to the card input so the next Enter records the visit.
            input.current?.focus();
          }}
        >
          <option value="">Choose purpose</option>
          {PURPOSES.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </Field>
      {purpose === "Other" && (
        <Field label="Describe purpose">
          <input
            maxLength="250"
            className={inputClass}
            value={other}
            onChange={(event) => setOther(event.target.value)}
          />
        </Field>
      )}
      <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={tabTerminator}
          onChange={(event) => setTabTerminator(event.target.checked)}
          className="h-3.5 w-3.5 accent-[#0B1330]"
        />
        This scanner uses Tab as terminator
      </label>
      <p className="text-xs text-slate-500">
        Scan or type the card, then press Enter — nothing else to review.
        Someone still inside gets a time out (no purpose needed); everyone else
        gets a time in with the chosen purpose. Nothing is written until the
        card is scanned.
      </p>
      {busy && (
        <div role="status" className="flex items-center gap-2 text-sm text-slate-600">
          <Spinner size="sm" /> Processing…
        </div>
      )}
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
