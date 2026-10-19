// Return flow for one on-loan copy: scan the BORROWER'S OWN card, set the
// return date+time, and record. The database checks the card against the
// loan record — any other card is rejected ("only the borrower can return").
// A late return is charged automatically (when fines are on) and the amount
// is reported in the confirmation.
import { useEffect, useRef, useState } from "react";
import { useToast } from "../../hooks/shared/useToast.js";
import { returnLoan } from "../../services/borrow/borrowService.js";
import { getSettings } from "../../services/fines/finesService.js";
import { daysLabel, daysLateBetween, peso } from "../../services/fines/fineRules.js";
import {
  manilaInputValue,
  manilaInputToIso,
  returnDateError,
} from "../../services/borrow/loanRules.js";
import {
  normalizeCard,
  displayTime,
} from "../../services/attendance/attendanceRules.js";
import { Field, inputClass, buttonClass } from "../attendance/StaffUi.jsx";
import { secondaryButton } from "../attendance/WorkspaceUi.jsx";

export default function ReturnAction({ loan, onDone, onCancel }) {
  const toast = useToast();
  const [card, setCard] = useState("");
  const [returnedAt, setReturnedAt] = useState(() => manilaInputValue());
  const [finesConfig, setFinesConfig] = useState(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  // The fines setting decides whether a late return reports a charge.
  useEffect(() => {
    let active = true;
    getSettings()
      .then((settings) => {
        if (active) setFinesConfig(settings.fines ?? null);
      })
      .catch(() => {
        if (active) setFinesConfig(null);
      });
    return () => {
      active = false;
    };
  }, []);

  async function submit() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const normalized = normalizeCard(card);
      const dateError = returnDateError({
        borrowedAt: loan.borrowed_at,
        returned: returnedAt,
      });
      if (dateError) throw new Error(dateError);
      const returnedIso = manilaInputToIso(returnedAt);
      await returnLoan(loan.id, normalized, returnedIso);
      const rate = Number(finesConfig?.rate_per_day ?? 0);
      const lateDays =
        finesConfig?.enabled && rate > 0
          ? daysLateBetween(loan.due_at, returnedIso ?? new Date())
          : 0;
      toast.success(
        lateDays > 0
          ? `Copy returned. ${peso(lateDays * rate)} fine assessed (${daysLabel(lateDays)}).`
          : "Copy returned.",
      );
      onDone();
    } catch (error) {
      toast.error(error.message, "Not returned");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <section
      aria-label={`Return ${loan.accession_number}`}
      className="space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="text-xs font-semibold text-accent hover:underline"
          onClick={onCancel}
        >
          ← Back to copies
        </button>
        <p className="text-xs text-slate-500">
          Copy <strong className="text-ink">{loan.accession_number}</strong>
        </p>
      </div>

      <div className="rounded-xl bg-page p-4">
        <p className="text-sm font-semibold text-ink">
          Borrowed by {loan.holder} · {loan.library_id}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          {displayTime(loan.borrowed_at)} → due {displayTime(loan.due_at)}
          {loan.is_overdue ? " · overdue" : ""}
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          Only {loan.holder}'s own card can return this copy. Another member's
          card is rejected.
        </p>
      </div>

      <Field label="Library card (the borrower must return it)">
        <input
          autoFocus
          className={inputClass}
          value={card}
          autoComplete="off"
          maxLength="124"
          onChange={(event) => setCard(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void submit();
            }
          }}
        />
      </Field>

      <Field label="Return date & time (Manila)">
        <input
          type="datetime-local"
          className={inputClass}
          value={returnedAt}
          onChange={(event) => setReturnedAt(event.target.value)}
        />
      </Field>
      <p className="-mt-3 text-[11px] text-slate-500">
        Defaults to now. Old returns can use a past date, never before the
        borrow date.
      </p>

      <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-gradient-to-r from-page to-surface dark:border-white/10 dark:from-navy dark:to-navy-deep px-5 py-4 sm:-mx-6 sm:-mb-6 sm:px-6">
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className={secondaryButton}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || !card.trim()}
          onClick={submit}
          className={buttonClass}
        >
          {busy ? "Saving…" : "Record return"}
        </button>
      </div>
    </section>
  );
}
