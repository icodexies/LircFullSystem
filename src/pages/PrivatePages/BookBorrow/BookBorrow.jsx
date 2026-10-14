// Book Borrow: search the catalog like the OPAC, open a book to borrow or
// return its copies by accession number, and browse the borrow records —
// borrowed / overdue / returned — in the tabs, with search and filters.
import { useEffect, useState } from "react";
import { useCatalog } from "../../../hooks/catalog/useCatalog.js";
import { SEARCH_FIELDS } from "../../../services/catalog/catalogQuery.js";
import { getLoanRecords } from "../../../services/borrow/borrowService.js";
import {
  WorkspaceHeader,
  WorkspacePanel,
  secondaryButton,
} from "../../../components/attendance/WorkspaceUi.jsx";
import { inputClass, tableButton } from "../../../components/attendance/StaffUi.jsx";
import BookCover from "../../../components/catalog/BookCover.jsx";
import { LoadingBlock } from "../../../components/ui/Loading.jsx";
import BookLoanDialog from "../../../components/borrow/BookLoanDialog.jsx";
import LoanRecordsPanel from "../../../components/borrow/LoanRecordsPanel.jsx";

const TABS = [
  { id: "action", label: "Borrow & return" },
  { id: "borrowed", label: "Borrowed" },
  { id: "overdue", label: "Overdue" },
  { id: "returned", label: "Returned" },
];

export default function BookBorrow() {
  const catalog = useCatalog();
  const [selection, setSelection] = useState(null);
  const [tab, setTab] = useState("action");
  const [counts, setCounts] = useState(null);
  const [recordsRevision, setRecordsRevision] = useState(0);
  const busy = catalog.loading || catalog.searching;

  // The tab badges are visible before a records tab is opened.
  useEffect(() => {
    let active = true;
    getLoanRecords({ scope: "borrowed", page: 1, pageSize: 1 })
      .then((data) => {
        if (active && data?.counts) setCounts(data.counts);
      })
      .catch(() => {
        // The badges simply stay hidden until a records tab loads.
      });
    return () => {
      active = false;
    };
  }, [recordsRevision]);

  // A borrow or return inside the window may change the records.
  function closeDialog() {
    setSelection(null);
    setRecordsRevision((value) => value + 1);
  }

  return (
    <div className="space-y-6">
      <WorkspaceHeader
        title="Book Borrow"
        description="Find a book, copy it by accession number, and record the loan or return. Borrowed, overdue and returned records are searchable in the tabs below."
      />

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B4A86] ${
              tab === item.id
                ? "bg-[#0B1330] text-white"
                : "border border-slate-400 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-[#0B1330]"
            }`}
          >
            {item.label}
            {item.id === "borrowed" && counts?.borrowed > 0 && (
              <span className="rounded-full bg-[#F0EDFA] px-1.5 text-[10px] font-bold text-[#3B4A86]">
                {counts.borrowed}
              </span>
            )}
            {item.id === "overdue" && counts?.overdue > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                {counts.overdue}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "action" ? (
        <WorkspacePanel
          title="Find a book"
          description="Search like the OPAC. Open a book to see its accession numbers, who has them, and the borrowing history."
          actions={
            <button
              type="button"
              className={secondaryButton}
              onClick={catalog.refresh}
              disabled={busy}
            >
              Refresh
            </button>
          }
        >
          <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
            <select
              aria-label="Search by"
              className={`${inputClass} sm:w-44`}
              value={catalog.query.searchBy}
              onChange={(event) =>
                catalog.changeFilter("searchBy", event.target.value)
              }
            >
              {Object.entries(SEARCH_FIELDS).map(([field, label]) => (
                <option key={field} value={field}>
                  {label}
                </option>
              ))}
            </select>
            <input
              type="search"
              maxLength={120}
              className={`${inputClass} flex-1`}
              placeholder="Search a title, author… or scan/type an accession number"
              value={catalog.searchInput}
              onChange={(event) => catalog.setSearchInput(event.target.value)}
            />
          </div>

          <div className="px-5 py-4 sm:px-6">
            {busy ? (
              <LoadingBlock label="Searching the catalog…" className="min-h-[14rem]" />
            ) : catalog.error ? (
              <div
                role="alert"
                className="rounded-xl border border-red-100 bg-red-50 p-4 text-xs text-red-700"
              >
                {catalog.error}
              </div>
            ) : catalog.books.length === 0 ? (
              <p className="text-xs text-slate-500">
                No books match. Try another search or clear the search box.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {catalog.books.map((book) => (
                  <li
                    key={book.id}
                    className="flex flex-wrap items-center gap-4 py-3"
                  >
                    <BookCover book={book} className="h-20 w-14" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#0B1330]">
                        {book.book_name}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {book.author || "Author not recorded"} ·{" "}
                        {book.format?.name || "Unspecified format"}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        Call number {book.call_number || "not recorded"} ·{" "}
                        {book.section?.name || "No section"}
                      </p>
                    </div>
                    <button
                      type="button"
                      className={tableButton}
                      onClick={() => setSelection(book)}
                    >
                      Copies & loans
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <nav
            aria-label="Book search pagination"
            className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-[11px] text-slate-500 sm:px-6"
          >
            <span>
              Page {catalog.query.page}
              {busy ? "" : ` · ${catalog.books.length} shown`}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className={tableButton}
                disabled={busy || catalog.query.page === 1}
                onClick={() => catalog.setPage(catalog.query.page - 1)}
              >
                Previous
              </button>
              <button
                type="button"
                className={tableButton}
                disabled={busy || !catalog.hasNext}
                onClick={() => catalog.setPage(catalog.query.page + 1)}
              >
                Next
              </button>
            </div>
          </nav>
        </WorkspacePanel>
      ) : (
        <LoanRecordsPanel
          scope={tab}
          revision={recordsRevision}
          onCounts={setCounts}
          onOpenBook={(row) =>
            setSelection({
              id: row.book_id,
              book_name: row.book_name,
              author: row.author,
              call_number: row.call_number,
            })
          }
        />
      )}

      {selection && (
        <BookLoanDialog book={selection} onClose={closeDialog} />
      )}
    </div>
  );
}
