// Edit a loan record's dates from the Borrowed / Overdue / Returned lists.
// Library operators only. An open loan is closed with the Return action; this
// form corrects the start and due dates (and the return date of a loan that is
// already returned).
import { useId, useState } from "react";
import Modal from "../ui/Modal.jsx";
import { Field, inputClass, buttonClass } from "../attendance/StaffUi.jsx";
import { secondaryButton } from "../attendance/WorkspaceUi.jsx";
import { useToast } from "../../hooks/shared/useToast.js";
import { updateLoanDates } from "../../services/borrow/borrowService.js";
import {
  loanDateError,
  manilaInputToIso,
  manilaInputValue,
} from "../../services/borrow/loanRules.js";

export default function LoanEditModal({ loan, onClose, onDone }) {
  const toast = useToast();
  const formId = useId();
  const isReturned = Boolean(loan.returned_at);
  const [start, setStart] = useState(() =>
    manilaInputValue(new Date(loan.borrowed_at)),
  );
  const [due, setDue] = useState(() => manilaInputValue(new Date(loan.due_at)));
  const [returned, setReturned] = useState(() =>
    loan.returned_at ? manilaInputValue(new Date(loan.returned_at)) : "",
  );
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const error = loanDateError({ start, due, returned: isReturned ? returned : "" });
    if (error) {
      toast.error(error, "Check the dates");
      return;
    }
    setBusy(true);
    try {
      await updateLoanDates({
        loanId: loan.id,
        start: manilaInputToIso(start),
        due: manilaInputToIso(due),
        returned: isReturned ? manilaInputToIso(returned) : null,
      });
      toast.success("Loan dates updated.");
      onDone();
    } catch (failure) {
      toast.error(failure.message, "Not saved");
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Edit loan dates"
      description={`${loan.member_name} · ${loan.book_name}`}
      size="md"
      busy={busy}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            className={secondaryButton}
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            form={formId}
            className={buttonClass}
            disabled={busy}
          >
            {busy ? "Saving…" : "Save dates"}
          </button>
        </div>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-4 px-5 py-4 sm:px-6">
        <div className="rounded-xl bg-page p-4">
          <p className="text-sm font-semibold text-ink">{loan.member_name}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {loan.library_id} · Accession {loan.accession_number}
          </p>
          <p className="mt-1 text-xs text-slate-500">{loan.book_name}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start date & time (Manila)">
            <input
              type="datetime-local"
              required
              className={inputClass}
              value={start}
              onChange={(event) => setStart(event.target.value)}
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
          {isReturned && (
            <Field label="Return date & time (Manila)">
              <input
                type="datetime-local"
                className={inputClass}
                value={returned}
                onChange={(event) => setReturned(event.target.value)}
              />
            </Field>
          )}
        </div>

        <p className="text-[11px] leading-relaxed text-slate-500">
          The due date must be after the start, at most one year later. Use the
          Return action to close a loan that is still out. An already assessed
          fine is not recalculated when the dates change.
        </p>
      </form>
    </Modal>
  );
}
