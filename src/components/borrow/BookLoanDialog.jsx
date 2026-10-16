// Book modal for borrowing: every copy by accession number (available and
// on-loan, with who holds it), the borrowing history (people who borrowed
// this book), and the borrow/return actions.
import { useEffect, useState } from "react";
import CatalogDialog from "../catalog/CatalogDialog.jsx";
import BookCover from "../catalog/BookCover.jsx";
import BorrowAction from "./BorrowAction.jsx";
import ReturnAction from "./ReturnAction.jsx";
import Modal from "../ui/Modal.jsx";
import { useToast } from "../../hooks/shared/useToast.js";
import { getBookCopies } from "../../services/catalog/bookService.js";
import { getBookLoans } from "../../services/borrow/borrowService.js";
import {
  flagCopyLost,
  getSettings,
} from "../../services/fines/finesService.js";
import { daysLateBetween, peso } from "../../services/fines/fineRules.js";
import { displayTime } from "../../services/attendance/attendanceRules.js";
import { StatusBadge, secondaryButton } from "../attendance/WorkspaceUi.jsx";
import { inputClass, tableButton } from "../attendance/StaffUi.jsx";
import { SkeletonRows } from "../ui/Skeleton.jsx";
import { Spinner } from "../ui/Loading.jsx";

// The borrowing history lists this many rows per page.
const HISTORY_PAGE_SIZE = 6;

const lostButton =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:opacity-40";

// Confirms marking a copy lost; closes its loan and charges the borrower
// (the charge only exists while the fines setting is on).
function LostModal({ copy, open, finesOn, bookName, onClose, onDone }) {
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const charge = Boolean(open) && finesOn;

  async function submit() {
    if (busy) return;
    const value = Number(amount);
    if (charge && (!Number.isFinite(value) || value <= 0)) {
      toast.error("Enter the replacement amount the borrower should pay.");
      return;
    }
    setBusy(true);
    try {
      const result = await flagCopyLost(copy.id, charge ? value : 0, note);
      toast.success(
        result?.charged
          ? `Copy marked lost — ${peso(value)} charged to ${open.holder}.`
          : "Copy marked lost.",
      );
      onDone();
      onClose();
    } catch (error) {
      toast.error(error.message);
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Mark ${copy.accession_number} lost`}
      description={bookName}
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
            type="button"
            className={lostButton}
            onClick={submit}
            disabled={busy}
          >
            {busy && <Spinner size="sm" />}
            Mark lost
          </button>
        </div>
      }
    >
      <div className="space-y-4 px-5 py-4 sm:px-6">
        <p className="text-xs leading-relaxed text-slate-600">
          {charge ? (
            <>
              This copy is on loan to{" "}
              <strong className="text-ink">{open.holder}</strong> (
              {open.library_id}). Marking it lost closes the loan and charges
              the borrower the replacement amount.
            </>
          ) : open ? (
            <>
              This copy is on loan to{" "}
              <strong className="text-ink">{open.holder}</strong>. Fines are
              off, so the loan is only closed — no charge is recorded.
            </>
          ) : (
            <>
              This copy is available. It stops circulating right away; nobody
              is charged.
            </>
          )}
        </p>

        {charge && (
          <label className="block">
            <span className="mb-1 block text-xs text-slate-600">
              Replacement amount (₱)
            </span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              data-modal-autofocus="true"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className={inputClass}
              placeholder="For example: 450"
            />
          </label>
        )}

        <label className="block">
          <span className="mb-1 block text-xs text-slate-600">
            Note (optional)
          </span>
          <textarea
            rows={2}
            maxLength={200}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="w-full rounded-xl border border-slate-400 bg-surface px-3 py-2.5 text-xs text-ink placeholder:text-slate-500 focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/15"
            placeholder="For example: reported missing after the last loan"
          />
        </label>
      </div>
    </Modal>
  );
}

export default function BookLoanDialog({ book, onClose }) {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [copies, setCopies] = useState(null);
  const [loans, setLoans] = useState(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [borrowCopy, setBorrowCopy] = useState(null);
  const [returnTarget, setReturnTarget] = useState(null);
  const [lostCopy, setLostCopy] = useState(null);
  const [finesConfig, setFinesConfig] = useState(null);

  // The fines setting drives the accruing amounts and the lost-copy charge.
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

  useEffect(() => {
    let active = true;
    Promise.all([getBookCopies(book.id, page), getBookLoans(book.id)])
      .then(([copyData, loanRows]) => {
        if (!active) return;
        // getBookCopies returns { copies, hasNext }; keep the dialog's row shape.
        setCopies({ rows: copyData.copies, hasNext: copyData.hasNext });
        setLoans(loanRows);
      })
      .catch((error) => {
        if (active) toast.error(error.message, "Copies not loaded");
      });
    return () => {
      active = false;
    };
  }, [book.id, page, revision, toast]);

  const refresh = () => {
    setHistoryPage(1);
    setRevision((value) => value + 1);
  };
  const openByAccession = new Map(
    (loans ?? []).filter((loan) => loan.is_open).map((loan) => [loan.accession_id, loan]),
  );
  // The borrowing history pages six rows at a time, newest first.
  const historyPages = Math.max(1, Math.ceil((loans?.length ?? 0) / HISTORY_PAGE_SIZE));
  const safeHistoryPage = Math.min(historyPage, historyPages);
  const historyRows = (loans ?? []).slice(
    (safeHistoryPage - 1) * HISTORY_PAGE_SIZE,
    safeHistoryPage * HISTORY_PAGE_SIZE,
  );

  return (
    <CatalogDialog
      title={
        borrowCopy
          ? `Borrow ${borrowCopy.accession_number}`
          : returnTarget
            ? `Return ${returnTarget.accession_number}`
            : "Copies & loans"
      }
      description={book.book_name}
      onClose={onClose}
      footer={
        !borrowCopy &&
        !returnTarget && (
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button type="button" onClick={onClose} className={secondaryButton}>
              Close
            </button>
          </div>
        )
      }
    >
      <div className="space-y-6 p-5 sm:p-6">
        {borrowCopy ? (
          <BorrowAction
            copy={borrowCopy}
            onCancel={() => setBorrowCopy(null)}
            onDone={() => {
              setBorrowCopy(null);
              refresh();
            }}
          />
        ) : returnTarget ? (
          <ReturnAction
            loan={returnTarget}
            onCancel={() => setReturnTarget(null)}
            onDone={() => {
              setReturnTarget(null);
              refresh();
            }}
          />
        ) : (
          <>
            <div className="rounded-2xl border border-slate-200 bg-page p-5">
              <div className="flex gap-4">
                <BookCover
                  book={book}
                  className="h-28 w-20 shrink-0 border-slate-200 shadow-sm"
                />
                <div className="min-w-0">
                  <span className="inline-flex max-w-full truncate rounded-full bg-tint px-2.5 py-0.5 text-[11px] font-semibold text-accent">
                    {book.format?.name || "Unspecified format"}
                  </span>
                  <h3 className="mt-2 break-words font-serif text-lg font-bold leading-snug text-ink">
                    {book.book_name}
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-600">
                    {book.author || "Author not recorded"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Call number {book.call_number || "not recorded"} ·{" "}
                    {book.section?.name || "No section"}
                  </p>
                </div>
              </div>
            </div>

            <section>
              <h4 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <span
                  aria-hidden="true"
                  className="h-4 w-1 rounded-full bg-navy"
                />
                Copies (accession numbers)
              </h4>
              <p className="mt-1 text-xs text-slate-500">
                Borrow uses the exact copy. A copy is unavailable while it is
                on loan; return it first or choose another copy. Copies marked
                damaged, missing or lost are kept in Inventory and are not
                shown here.
              </p>
              {copies === null ? (
                <SkeletonRows count={3} label="Loading copies…" />
              ) : copies.rows.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">
                  No copy records for this book.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100">
                  {copies.rows.map((copy) => {
                    const open = openByAccession.get(copy.id);
                    const statusText = (copy.status ?? "").trim();
                    const borrowable =
                      !open &&
                      (statusText === "" ||
                        statusText.toLowerCase() === "available");
                    const rate = Number(finesConfig?.rate_per_day ?? 0);
                    const accruing =
                      open && finesConfig?.enabled && rate > 0
                        ? daysLateBetween(open.due_at, new Date()) * rate
                        : 0;
                    return (
                      <li
                        key={copy.id}
                        className="flex flex-wrap items-center justify-between gap-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink">
                            {copy.accession_number}
                          </p>
                          {open ? (
                            <p className="mt-0.5 text-xs text-slate-500">
                              On loan — {open.holder} · due{" "}
                              {displayTime(open.due_at)}
                              {open.is_overdue && (
                                <span className="ml-2 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                                  Overdue
                                </span>
                              )}
                              {accruing > 0 && (
                                <span className="ml-2 font-semibold text-red-700">
                                  {peso(accruing)} accruing
                                </span>
                              )}
                            </p>
                          ) : (
                            <p className="mt-0.5 text-xs text-slate-500">
                              Available
                              {statusText ? ` · ${statusText}` : ""}
                            </p>
                          )}
                        </div>
                        {open ? (
                          <span className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              className={tableButton}
                              onClick={() => setReturnTarget(open)}
                            >
                              Return this copy
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                              onClick={() => setLostCopy({ copy, open })}
                            >
                              Mark lost
                            </button>
                          </span>
                        ) : borrowable ? (
                          <button
                            type="button"
                            className={tableButton}
                            onClick={() => setBorrowCopy(copy)}
                          >
                            Borrow this copy
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500">
                            Not available ({statusText})
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {(page > 1 || copies?.hasNext) && (
                <div className="mt-3 flex items-center justify-end gap-3 text-[11px] text-slate-500">
                  <button
                    type="button"
                    className={tableButton}
                    disabled={page === 1}
                    onClick={() => setPage((value) => value - 1)}
                  >
                    Previous
                  </button>
                  <span>Page {page}</span>
                  <button
                    type="button"
                    className={tableButton}
                    disabled={!copies?.hasNext}
                    onClick={() => setPage((value) => value + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </section>

            <section className="border-t border-slate-100 pt-5">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-ink">
                <span
                  aria-hidden="true"
                  className="h-4 w-1 rounded-full bg-navy"
                />
                Borrowing history
              </h4>
              <p className="mt-1 text-xs text-slate-500">
                Everyone who borrowed this book — current loans and returns.
              </p>
              {loans === null ? (
                <SkeletonRows count={3} label="Loading history…" />
              ) : loans.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">
                  No one has borrowed this book yet.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100">
                  {historyRows.map((loan) => (
                    <li
                      key={loan.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-ink">
                          {loan.holder}{" "}
                          <span className="font-normal text-slate-500">
                            · {loan.library_id}
                          </span>
                        </p>
                        <p className="mt-0.5 text-slate-500">
                          {loan.accession_number} ·{" "}
                          {displayTime(loan.borrowed_at)} →{" "}
                          {loan.returned_at
                            ? displayTime(loan.returned_at)
                            : `due ${displayTime(loan.due_at)}`}
                        </p>
                      </div>
                      {loan.is_open ? (
                        loan.is_overdue ? (
                          <StatusBadge tone="warning">Overdue</StatusBadge>
                        ) : (
                          <StatusBadge tone="success">Still out</StatusBadge>
                        )
                      ) : (
                        <StatusBadge tone="muted">Returned</StatusBadge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {(safeHistoryPage > 1 || safeHistoryPage < historyPages) && (
                <div className="mt-3 flex items-center justify-end gap-3 text-[11px] text-slate-500">
                  <button
                    type="button"
                    className={tableButton}
                    disabled={safeHistoryPage === 1}
                    onClick={() => setHistoryPage(safeHistoryPage - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {safeHistoryPage} of {historyPages}
                  </span>
                  <button
                    type="button"
                    className={tableButton}
                    disabled={safeHistoryPage >= historyPages}
                    onClick={() => setHistoryPage(safeHistoryPage + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </section>
          </>
        )}
      </div>
      {lostCopy && (
        <LostModal
          copy={lostCopy.copy}
          open={lostCopy.open}
          finesOn={Boolean(finesConfig?.enabled)}
          bookName={book.book_name}
          onClose={() => setLostCopy(null)}
          onDone={refresh}
        />
      )}
    </CatalogDialog>
  );
}
