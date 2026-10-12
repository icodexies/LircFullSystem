// Book Borrow: search the catalog like the OPAC, open a book to borrow or
// return its copies by accession number, and look up a member's borrowings.
import { useState } from "react";
import { useCatalog } from "../../../hooks/catalog/useCatalog.js";
import { SEARCH_FIELDS } from "../../../services/catalog/catalogQuery.js";
import {
  WorkspaceHeader,
  WorkspacePanel,
  secondaryButton,
} from "../../../components/attendance/WorkspaceUi.jsx";
import { inputClass, tableButton } from "../../../components/attendance/StaffUi.jsx";
import BookCover from "../../../components/catalog/BookCover.jsx";
import { LoadingBlock } from "../../../components/ui/Loading.jsx";
import BookLoanDialog from "../../../components/borrow/BookLoanDialog.jsx";

export default function BookBorrow() {
  const catalog = useCatalog();
  const [selection, setSelection] = useState(null);
  const busy = catalog.loading || catalog.searching;

  return (
    <div className="space-y-6">
      <WorkspaceHeader
        title="Book Borrow"
        description="Find a book, copy it by accession number, and record the loan. Returns happen inside the book's copies window; member histories live on the Users page."
      />

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

      {selection && (
        <BookLoanDialog book={selection} onClose={() => setSelection(null)} />
      )}
    </div>
  );
}
