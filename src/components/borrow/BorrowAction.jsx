// Borrow flow for one copy: scan the member's card, review the validation
// and overdue warning, set the start/due date+time (old records allowed),
// then record the loan.
import { useRef, useState } from "react";
import { useDialog } from "../../hooks/shared/useDialog.js";
import { useToast } from "../../hooks/shared/useToast.js";
import {
  borrowPreview,
  borrowBook,
} from "../../services/borrow/borrowService.js";
import {
  manilaInputValue,
  manilaInputToIso,
  addDaysInput,
  loanDateError,
} from "../../services/borrow/loanRules.js";
import { normalizeCard } from "../../services/attendance/attendanceRules.js";
import { Field, inputClass, buttonClass } from "../attendance/StaffUi.jsx";
import { secondaryButton } from "../attendance/WorkspaceUi.jsx";

export default function BorrowAction({ copy, onDone, onCancel }) {
  const dialog = useDialog();
  const toast = useToast();
  const [card, setCard] = useState("");
  const [preview, setPreview] = useState(null);
  const [start, setStart] = useState(() => manilaInputValue());
  const [due, setDue] = useState(() => addDaysInput(manilaInputValue(), 7));
  const [returnedFlag, setReturnedFlag] = useState(false);
  const [returnedAt, setReturnedAt] = useState(() => manilaInputValue());
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const inputRef = useRef(null);

  async function lookup(event) {
    event?.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const normalized = normalizeCard(card);
      const data = await borrowPreview(normalized);
      setPreview(data);
      setCard(normalized);
    } catch (error) {
      setPreview(null);
      toast.error(error.message, "Card not loaded");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function changeStart(value) {
    setStart(value);
    const startIso = manilaInputToIso(value);
    const dueIso = manilaInputToIso(due);
    if (!dueIso || (startIso && Date.parse(dueIso) <= Date.parse(startIso))) {
      const next = addDaysInput(value, 7);
      if (next) setDue(next);
    }
  }

  async function submit() {
    if (lock.current || !preview) return;
    const returned = returnedFlag ? returnedAt : "";
    const dateError = loanDateError({ start, due, returned });
    if (dateError) {
      toast.error(dateError, "Check the dates");
      return;
    }
    // Overdue members are warned before anything is submitted.
    if (preview.overdue_loans > 0) {
      const go = await dialog.confirm({
        title: "This member has overdue book(s)",
        variant: "warning",
        message: `${preview.profile.full_name} has ${preview.overdue_loans} overdue book(s): ${preview.overdue_text}. Borrow anyway?`,
        confirmLabel: "Borrow anyway",
        cancelLabel: "Cancel",
      });
      if (!go) return;
    }
    lock.current = true;
    setBusy(true);
    try {
      await borrowBook({
        accession: copy.accession_number,
        profileId: preview.profile.id,
        start: manilaInputToIso(start),
        due: manilaInputToIso(due),
        returned: returned ? manilaInputToIso(returned) : null,
      });
      toast.success(
        returnedFlag
          ? `"${copy.accession_number}" saved as an old record (borrowed and returned).`
          : `"${copy.accession_number}" borrowed for ${preview.profile.full_name}.`,
      );
      onDone();
    } catch (error) {
      toast.error(error.message, "Not saved");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const studentCheck = preview?.student_check;

  return (
    <section aria-label={`Borrow ${copy.accession_number}`} className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="text-xs font-semibold text-accent hover:underline"
          onClick={onCancel}
        >
          ← Back to copies
        </button>
        <p className="text-xs text-slate-500">
          Copy <strong className="text-ink">{copy.accession_number}</strong>
        </p>
      </div>

      <form onSubmit={lookup} className="flex flex-wrap items-end gap-3">
        <Field label="Library card" className="min-w-60 flex-1">
          <input
            ref={inputRef}
            className={inputClass}
            value={card}
            autoComplete="off"
            maxLength="124"
            onChange={(event) => {
              setCard(event.target.value);
              setPreview(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void lookup();
              }
            }}
          />
        </Field>
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy && !preview ? "Looking up…" : "Look up card"}
        </button>
      </form>
      <p className="-mt-3 text-[11px] text-slate-500">
        Scan or type the card, then press Enter. Enter only looks up the card.
      </p>

      {preview && (
        <div className="space-y-3 rounded-xl bg-page p-4">
          <p className="text-sm font-semibold text-ink">
            {preview.profile.full_name} · {preview.profile.library_id}
          </p>
          <p className="text-xs text-slate-500">
            {preview.profile.role.replaceAll("_", " ")} · {preview.active_loans}{" "}
            active loan{preview.active_loans === 1 ? "" : "s"}
            {preview.overdue_loans > 0
              ? ` · ${preview.overdue_loans} overdue`
              : ""}
          </p>
          {studentCheck?.required && (
            <p
              className={`text-xs ${studentCheck.ok ? "text-slate-500" : "font-semibold text-amber-800"}`}
            >
              {studentCheck.ok
                ? "Library validation is complete for the current school year."
                : studentCheck.reason}
            </p>
          )}
          {studentCheck?.required && !studentCheck.ok && (
            <p className="text-[11px] leading-relaxed text-slate-500">
              Historical records (start date outside the current school year)
              skip this check.
            </p>
          )}
          {preview.overdue_loans > 0 && (
            <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
              Overdue: {preview.overdue_text}. You will be asked to confirm
              before the loan is recorded.
            </p>
          )}
        </div>
      )}

      <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
        <Field label="Start date & time (Manila)">
          <input
            type="datetime-local"
            required
            className={inputClass}
            value={start}
            onChange={(event) => changeStart(event.target.value)}
          />
        </Field>
        <Field label="Due date & time (Manila)">
          <input
            type="datetime-local"
            required
            className={inputClass}
            value={due}
            onChange={(event) => setDue(event.target.value)}
          />
        </Field>
      </fieldset>
      <p className="-mt-3 text-[11px] text-slate-500">
        The due date/time must be after the start, at most one year later. Old
        records can use past dates.
      </p>

      <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={returnedFlag}
          onChange={(event) => setReturnedFlag(event.target.checked)}
          className="h-3.5 w-3.5 accent-ink"
        />
        This loan was already returned (old record)
      </label>
      {returnedFlag && (
        <Field label="Return date & time (Manila)">
          <input
            type="datetime-local"
            className={inputClass}
            value={returnedAt}
            onChange={(event) => setReturnedAt(event.target.value)}
          />
        </Field>
      )}

      <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-gradient-to-r from-page to-surface px-5 py-4 sm:-mx-6 sm:-mb-6 sm:px-6">
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
          disabled={busy || !preview}
          onClick={submit}
          className={buttonClass}
          title={preview ? undefined : "Look up the card first"}
        >
          {busy && preview ? "Saving…" : "Record loan"}
        </button>
      </div>
    </section>
  );
}
