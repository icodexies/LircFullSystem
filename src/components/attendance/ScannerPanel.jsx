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
//
// Guest cards (GUEST-01..GUEST-10) are the one exception: the panel pauses,
// asks for the guest's real name (and any other information), and saves both
// on the visit. The card itself stays free for the next visitor.
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

const DEFAULT_PURPOSE = "Study";

const TONES = {
  success: "bg-jade-soft text-jade-deep",
  warning: "bg-amber-50 text-amber-900",
  error: "bg-red-50 text-red-700",
};

export default function ScannerPanel({ onChanged, onClose, onBusy }) {
  const periods = useSemester();
  const [card, setCard] = useState("");
  const [purpose, setPurpose] = useState(DEFAULT_PURPOSE);
  const [other, setOther] = useState("");
  // A scanned guest card pauses here: the real guest's name (and any other
  // information) is typed once and saved on the visit.
  const [guest, setGuest] = useState(null);
  const [guestName, setGuestName] = useState("");
  const [guestDetail, setGuestDetail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  useEffect(() => {
    onBusy?.(busy);
  }, [busy, onBusy]);
  const [tabTerminator, setTabTerminator] = useState(false);
  const input = useRef(null);
  const guestInput = useRef(null);
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
  // A guest mid-entry keeps the cursor in the guest name field.
  useEffect(() => {
    if (busy) return;
    if (guest) {
      guestInput.current?.focus();
      return;
    }
    const field = input.current;
    field?.focus();
    if (field?.value) field.select();
  }, [busy, guest]);

  // Enter or the button: look up the card, decide, and record in one step.
  // A guest card is the one exception — it waits for the guest's name.
  async function record() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const purposeText = purpose === "Others" ? other.trim() : purpose;
    const clearGuest = () => {
      setGuest(null);
      setGuestName("");
      setGuestDetail("");
    };
    try {
      const refreshed = await periods.refreshSemesters();
      if (!refreshed)
        throw new Error("Refresh academic periods before scanning.");

      // Second step of a guest visit: the card was read, the name is filled.
      if (guest) {
        const name = guestName.trim();
        if (!name) {
          if (mounted.current)
            setResult({
              tone: "warning",
              text: "Type the guest's name first.",
            });
          return;
        }
        const fresh = await lookupCard(guest.card, abort.signal);
        if (!mounted.current) return;
        if (fresh.open_visit) {
          setResult({
            tone: "warning",
            text: "This guest card already has an open visit. Scan the card again to record the time out.",
          });
          clearGuest();
          return;
        }
        const blocked = timeInReason(
          fresh,
          periods.selectedSemesterId,
          purpose,
          other,
        );
        if (blocked) {
          setResult({ tone: "warning", text: blocked });
          clearGuest();
          return;
        }
        await recordTimeIn(
          fresh.profile.id,
          fresh.active_semester.id,
          purposeText,
          { name, detail: guestDetail.trim() },
        );
        if (mounted.current) {
          setResult({
            tone: "success",
            text: `${name} — guest time in recorded · ${purposeText} · ${displayTime(new Date())}`,
          });
          clearGuest();
          setCard("");
          onChanged();
        }
        return;
      }

      const normalized = normalizeCard(card);
      const preview = await lookupCard(normalized, abort.signal);
      if (!mounted.current) return;

      // Already inside: record the time out. The purpose saved at time in
      // stays on the record; nothing is asked here.
      if (preview.open_visit) {
        await recordTimeOut(preview.open_visit.id);
        if (mounted.current) {
          setResult({
            tone: "success",
            text: `${preview.open_visit.guest_name || personName(preview.profile)} — time out recorded · ${displayTime(new Date())}`,
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

      // A guest card waits for the guest's name before anything is saved.
      if (preview.profile.role === "guest") {
        if (mounted.current) {
          setGuest({ card: normalized });
          setCard("");
          setResult({
            tone: "warning",
            text: `Guest card ${normalized} read — type the guest's name, then press Enter or Record visit.`,
          });
        }
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
        purposeText,
      );
      if (mounted.current) {
        setResult({
          tone: "success",
          text: `${personName(fresh.profile)} — time in recorded · ${purposeText} · ${displayTime(new Date())}`,
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

  function cancelGuest() {
    setGuest(null);
    setGuestName("");
    setGuestDetail("");
    setResult(null);
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
          The highlighted purpose is saved with every time in until you change
          it. Someone still inside gets a time out instead — no purpose needed.
        </p>
      </div>

      {purpose === "Others" && (
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
        {guest ? (
          <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-amber-900">
                Guest card {guest.card} — who is visiting?
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={cancelGuest}
                className="text-[11px] font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-950 disabled:opacity-60"
              >
                Cancel guest entry
              </button>
            </div>
            <Field label="Guest name">
              <input
                ref={guestInput}
                className={inputClass}
                value={guestName}
                disabled={busy}
                autoComplete="off"
                maxLength="120"
                placeholder="Type the guest's full name…"
                onChange={(event) => setGuestName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!event.repeat) void record();
                  }
                }}
              />
            </Field>
            <Field label="Other information (optional)">
              <input
                className={inputClass}
                value={guestDetail}
                disabled={busy}
                autoComplete="off"
                maxLength="250"
                placeholder="School, company, contact number…"
                onChange={(event) => setGuestDetail(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!event.repeat) void record();
                  }
                }}
              />
            </Field>
            <p className="text-[11px] text-amber-900/80">
              The name and details are saved on this visit only — the guest
              card stays free for the next visitor.
            </p>
          </div>
        ) : (
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
        )}
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={tabTerminator}
          onChange={(event) => setTabTerminator(event.target.checked)}
          className="h-3.5 w-3.5 accent-ink"
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
        without touching anything else. Guests without a card use GUEST-01 to
        GUEST-10 — the panel asks for their name.
      </p>
      <div className="sticky bottom-0 -mx-6 -mb-6 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-gradient-to-r from-page to-surface dark:border-white/10 dark:from-navy dark:to-navy-deep px-6 py-4">
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
