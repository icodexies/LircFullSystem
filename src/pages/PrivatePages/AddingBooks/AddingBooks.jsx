// Adding Books (librarian / admin): create a book record together with its
// physical copies, or add accession numbers to an existing record.
// The catalog list below refreshes after every save.
import { useState } from "react";
import { useCatalog } from "../../../hooks/catalog/useCatalog.js";
import { SEARCH_FIELDS } from "../../../services/catalog/catalogQuery.js";
import {
  WorkspaceHeader,
  WorkspacePanel,
  secondaryButton,
  heroPrimary,
} from "../../../components/attendance/WorkspaceUi.jsx";
import {
  inputClass,
  tableButton,
} from "../../../components/attendance/StaffUi.jsx";
import BookCover from "../../../components/catalog/BookCover.jsx";
import AddBookDialog from "../../../components/catalog/AddBookDialog.jsx";
import Modal from "../../../components/ui/Modal.jsx";
import { LoadingBlock } from "../../../components/ui/Loading.jsx";

export default function AddingBooks() {
  const catalog = useCatalog();
  const [adding, setAdding] = useState(false);
  const busy = catalog.loading || catalog.searching;

  return (
    <div className="space-y-6">
      <WorkspaceHeader
        title="Adding Books"
        description="Create a book record with its accession numbers, or add copies to an existing record."
        actions={
          <button
            type="button"
            className={heroPrimary}
            onClick={() => setAdding(true)}
          >
            Add Book
          </button>
        }
      />

      <WorkspacePanel
        title="Catalog records"
        description="Search the catalog. The list refreshes after saving a book."
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
            placeholder="Search a title, author, ISBN, call number…"
            value={catalog.searchInput}
            onChange={(event) => catalog.setSearchInput(event.target.value)}
          />
        </div>

        <div className="px-5 py-4 sm:px-6">
          {busy ? (
            <LoadingBlock label="Loading records…" className="min-h-[14rem]" />
          ) : catalog.error ? (
            <div
              role="alert"
              className="rounded-xl border border-red-100 bg-red-50 p-4 text-xs text-red-700"
            >
              {catalog.error}
            </div>
          ) : catalog.books.length === 0 ? (
            <p className="text-xs text-slate-500">
              No records match. Try another search, or press Add Book to create
              one.
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
                </li>
              ))}
            </ul>
          )}
        </div>

        <nav
          aria-label="Catalog pagination"
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

      {adding && (
        <Modal
          title="Add a book"
          description="Enter the book details, then one accession number per physical copy."
          icon={
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z M12 7v6 M9 10h6" />
            </svg>
          }
          size="lg"
          onClose={() => setAdding(false)}
          dismissOnBackdrop={false}
        >
          <AddBookDialog
            onClose={() => setAdding(false)}
            onSaved={() => {
              setAdding(false);
              catalog.refresh();
            }}
          />
        </Modal>
      )}
    </div>
  );
}
