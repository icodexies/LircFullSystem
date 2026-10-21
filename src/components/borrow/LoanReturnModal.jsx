// Return a copy straight from the Borrowed / Overdue list. The desk scanner
// reads the borrower's card; this convenience action is for staff, librarian
// and admin (the database checks the role). The return date defaults to now
// (Manila) and can be backdated, like the desk flow. An overdue fine is
// assessed by the existing trigger when the return is saved.
import { useId, useState } from "react";
import Modal from "../ui/Modal.jsx";
import { Field, inputClass, buttonClass } from "../attendance/StaffUi.jsx";
import { secondaryButton } from "../attendance/WorkspaceUi.jsx";
import { useToast } from "../../hooks/shared/useToast.js";
import { operatorReturnLoan } from "../../services/borrow/borrowService.js";
import {
  manilaInputToIso,
  manilaInputValue,
  returnDateError,
} from "../../services/borrow/loanRules.js";

export default function LoanReturnModal({ loan, onClose, onDone }) {
  const toast = useToast();
  const formId = useId();
  const [returned, setReturned] = useState(() => manilaInputValue());
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const error = returnDateError({ borrowedAt: loan.borrowed_at, returned });
    if (error) {
      toast.error(error, "Check the date");
      return;
    }
    setBusy(true);
    try {
      await operatorReturnLoan({
        loanId: loan.id,
        returned: manilaInputToIso(returned),
      });
      toast.success(
        `"${loan.book_name}" returned for ${loan.member_name}.`,
        "Return recorded",
      );
      onDone();
    } catch (failure) {
      toast.error(failure.message, "Not returned");
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Record a return"
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
            {busy ? "Saving…" : "Record return"}
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
          <p className="mt-1 text-xs text-slate-500">
            {loan.book_name} · due{" "}
            {new Date(loan.due_at).toLocaleDateString("en-PH", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>

        <Field label="Return date & time (Manila)">
          <input
            type="datetime-local"
            required
            className={inputClass}
            value={returned}
            onChange={(event) => setReturned(event.target.value)}
          />
        </Field>

        <p className="text-[11px] leading-relaxed text-slate-500">
          The return cannot be before the loan started or in the future. If the
          copy is overdue and fines are on, the charge is assessed when you
          record the return.
        </p>
      </form>
    </Modal>
  );
}
