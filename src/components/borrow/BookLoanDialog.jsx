// Book modal for borrowing: every copy by accession number (available and
// on-loan, with who holds it), the borrowing history (people who borrowed
// this book), and the borrow/return actions.
import { useEffect, useState } from "react";
import CatalogDialog from "../catalog/CatalogDialog.jsx";
import BookCover from "../catalog/BookCover.jsx";
import BorrowAction from "./BorrowAction.jsx";
import ReturnAction from "./ReturnAction.jsx";
import { useToast } from "../../hooks/shared/useToast.js";
import { getBookCopies } from "../../services/catalog/bookService.js";
import { getBookLoans } from "../../services/borrow/borrowService.js";
import { displayTime } from "../../services/attendance/attendanceRules.js";
import { StatusBadge } from "../attendance/WorkspaceUi.jsx";
import { tableButton } from "../attendance/StaffUi.jsx";
import { LoadingBlock } from "../ui/Loading.jsx";
export default function BookLoanDialog({ book, onClose }) {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [copies, setCopies] = useState(null);
  const [loans, setLoans] = useState(null);
  const [revision, setRevision] = useState(0);
  const [borrowCopy, setBorrowCopy] = useState(null);
  const [returnTarget, setReturnTarget] = useState(null);

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

  const refresh = () => setRevision((value) => value + 1);
  const openByAccession = new Map(
    (loans ?? []).filter((loan) => loan.is_open).map((loan) => [loan.accession_id, loan]),
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
    >
      <div className="space-y-6 p-6">
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
            <div className="flex gap-4">
              <BookCover book={book} className="h-28 w-20" />
              <div className="min-w-0">
                <h3 className="break-words font-serif text-lg font-bold leading-snug text-[#0B1330]">
                  {book.book_name}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {book.author || "Author not recorded"}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Call number {book.call_number || "not recorded"} ·{" "}
                  {book.format?.name || "Unspecified format"} ·{" "}
                  {book.section?.name || "No section"}
                </p>
              </div>
            </div>

            <section>
              <h4 className="text-sm font-semibold text-[#0B1330]">
                Copies (accession numbers)
              </h4>
              <p className="mt-1 text-xs text-slate-500">
                Borrow uses the exact copy. A copy is unavailable while it is
                on loan; return it first or choose another copy.
              </p>
              {copies === null ? (
                <LoadingBlock label="Loading copies…" className="min-h-[8rem]" />
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
                    return (
                      <li
                        key={copy.id}
                        className="flex flex-wrap items-center justify-between gap-3 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#0B1330]">
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
                            </p>
                          ) : (
                            <p className="mt-0.5 text-xs text-slate-500">
                              Available
                              {statusText ? ` · ${statusText}` : ""}
                            </p>
                          )}
                        </div>
                        {open ? (
                          <button
                            type="button"
                            className={tableButton}
                            onClick={() => setReturnTarget(open)}
                          >
                            Return this copy
                          </button>
                        ) : borrowable ? (
                          <button
                            type="button"
                            className={tableButton}
                            onClick={() => setBorrowCopy(copy)}
                          >
                            Borrow this copy
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">
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
              <h4 className="text-sm font-semibold text-[#0B1330]">
                Borrowing history
              </h4>
              <p className="mt-1 text-xs text-slate-500">
                Everyone who borrowed this book — current loans and returns.
              </p>
              {loans === null ? (
                <LoadingBlock label="Loading history…" className="min-h-[6rem]" />
              ) : loans.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">
                  No one has borrowed this book yet.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100">
                  {loans.map((loan) => (
                    <li
                      key={loan.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-[#0B1330]">
                          {loan.holder}{" "}
                          <span className="font-normal text-slate-400">
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
            </section>
          </>
        )}
      </div>
    </CatalogDialog>
  );
}
