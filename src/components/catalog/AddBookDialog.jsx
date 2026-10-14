// The Add Book window (workflow):
// 1. Check first: enter or scan the ISBN (preferred) or search by title.
//    - Exactly one ISBN match  -> the record details fill the form and the
//      window switches to "adding copies to that record".
//    - Several matches        -> pick one ("Use this record").
//    - No match               -> the typed ISBN/title is carried into the
//      book form so a new record can be created.
// 2. When a record is linked, its SAVED COPIES load into the accession rows:
//    staff can edit them, remove them, or keep them, and add new rows.
//    Copies with loan records cannot be removed (the database refuses).
// 3. Save sends everything together; the database re-checks duplicates and
//    required fields. Errors stay in the form.
import { useEffect, useState } from "react";
import { useToast } from "../../hooks/shared/useToast.js";
import {
  findPossibleBooks,
  getCatalogLookups,
  getAccessionRowsForEdit,
  addBookWithCopies,
  saveBookCopies,
} from "../../services/catalog/bookService.js";
import {
  buildNewBook,
  buildAccessions,
  buildCopySavePlan,
  filledCopyCount,
} from "../../services/catalog/newBookRules.js";
import {
  Field,
  inputClass,
  buttonClass,
  tableButton,
} from "../attendance/StaffUi.jsx";
import { secondaryButton } from "../attendance/WorkspaceUi.jsx";
import { LoadingBlock } from "../ui/Loading.jsx";

// Row identity for the accession inputs (unique per dialog session).
let nextRowKey = 1;
const makeKey = () => nextRowKey++;
const makeRow = () => ({
  key: makeKey(),
  accession_number: "",
  shelf_id: "",
});
// A saved copy row: keeps its database id + original values so the save can
// tell updates from untouched rows.
const rowFromCopy = (copy) => {
  const shelf = copy.shelf_id == null ? "" : String(copy.shelf_id);
  return {
    key: makeKey(),
    id: copy.id,
    accession_number: copy.accession_number ?? "",
    shelf_id: shelf,
    original: {
      accession_number: copy.accession_number ?? "",
      shelf_id: shelf,
    },
  };
};

// An ISBN-ish query: starts with a digit and has 9+ digits/hyphens/spaces.
const looksLikeIsbn = (value) => /^[0-9][0-9\-\s]{8,}$/.test(value.trim());

export default function AddBookDialog({ onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    book_name: "",
    author: "",
    isbn: "",
    publisher: "",
    edition: "",
    call_number: "",
    publish_year: "",
  });
  const [rows, setRows] = useState(() => [makeRow()]);
  const [originalCopyIds, setOriginalCopyIds] = useState([]);
  const [loadingCopies, setLoadingCopies] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [matches, setMatches] = useState([]);
  const [linkedBook, setLinkedBook] = useState(null);
  const [applyShelf, setApplyShelf] = useState("");
  const [shelves, setShelves] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getCatalogLookups()
      .then((data) => {
        if (active) setShelves(data.shelves ?? []);
      })
      .catch(() => {
        // The shelf selects simply stay empty if the lookup fails.
      });
    return () => {
      active = false;
    };
  }, []);

  const change = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  // Choosing a match fills the record details, locks them, and loads its
  // saved copies into the accession rows for editing.
  async function fillFromRecord(book) {
    setLinkedBook(book);
    setForm({
      book_name: book.book_name ?? "",
      author: book.author ?? "",
      isbn: book.isbn ?? "",
      publisher: book.publisher ?? "",
      edition: book.edition ?? "",
      call_number: book.call_number ?? "",
      publish_year: book.publish_year == null ? "" : String(book.publish_year),
    });
    setOriginalCopyIds([]);
    setRows([makeRow()]);
    setLoadingCopies(true);
    try {
      const copies = await getAccessionRowsForEdit(book.id);
      setOriginalCopyIds(copies.map((copy) => copy.id));
      setRows(copies.length ? [...copies.map(rowFromCopy), makeRow()] : [makeRow()]);
    } catch (err) {
      setError(err?.message || "Couldn't load the record's copies.");
    } finally {
      setLoadingCopies(false);
    }
  }

  function unlinkBook() {
    setLinkedBook(null);
    setOriginalCopyIds([]);
    setRows([makeRow()]);
  }

  async function runSearch() {
    const query = searchQuery.trim();
    if (searching || query === "") return;
    setSearching(true);
    setError("");
    try {
      const isIsbn = looksLikeIsbn(query);
      const results = await findPossibleBooks({
        isbn: isIsbn ? query : "",
        title: isIsbn ? "" : query,
      });
      setMatches(results);
      setSearched(true);
      if (isIsbn && results.length === 1) {
        // A scanned ISBN with one match fills the record automatically.
        await fillFromRecord(results[0]);
      } else if (results.length === 0) {
        // No record: carry the search into the form to create a new book.
        setForm((current) =>
          isIsbn && !current.isbn
            ? { ...current, isbn: query }
            : !isIsbn && !current.book_name
              ? { ...current, book_name: query }
              : current,
        );
      }
    } finally {
      setSearching(false);
    }
  }

  const updateRow = (key, field, value) =>
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    );

  const addRow = () => setRows((current) => [...current, makeRow()]);

  const removeRow = (key) =>
    setRows((current) =>
      current.length === 1
        ? current.map((row) =>
            row.key === key
              ? { ...row, accession_number: "", shelf_id: "" }
              : row,
          )
        : current.filter((row) => row.key !== key),
    );

  function applyToAll() {
    setRows((current) =>
      current.map((row) => ({ ...row, shelf_id: applyShelf })),
    );
  }

  async function submit(event) {
    event.preventDefault();
    if (saving || loadingCopies) return;
    setError("");
    setSaving(true);
    try {
      if (linkedBook) {
        const plan = buildCopySavePlan(rows, originalCopyIds);
        const result = await saveBookCopies(linkedBook.id, plan);
        const parts = [];
        if (result?.added) parts.push(`${result.added} added`);
        if (result?.updated) parts.push(`${result.updated} updated`);
        if (result?.deleted) parts.push(`${result.deleted} removed`);
        toast.success(
          `Book record updated${parts.length ? ` — ${parts.join(", ")}` : ""}.`,
        );
      } else {
        const accessions = buildAccessions(rows);
        const book = buildNewBook(form);
        const result = await addBookWithCopies(book, accessions);
        const count = result?.copies_added ?? accessions.length;
        toast.success(
          `Book saved successfully with ${count} accession number${count === 1 ? "" : "s"}.`,
        );
      }
      onSaved();
    } catch (err) {
      setError(err?.message || "Couldn't save the book.");
    } finally {
      setSaving(false);
    }
  }

  const total = filledCopyCount(rows);

  return (
    <form onSubmit={submit} className="space-y-6 p-6">
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs leading-relaxed text-red-700"
        >
          {error}
        </div>
      )}

      {linkedBook ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#3B4A86]/20 bg-[#F0EDFA] p-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#3B4A86]">
              Adding copies to an existing record
            </p>
            <p className="mt-1 text-sm font-semibold text-[#0B1330]">
              {linkedBook.book_name}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Its details below are filled from the catalog and locked.
            </p>
          </div>
          <button
            type="button"
            className="text-xs font-semibold text-[#3B4A86] hover:underline"
            onClick={unlinkBook}
          >
            Create a new book instead
          </button>
        </div>
      ) : (
        <section className="rounded-xl border border-[#3B4A86]/20 bg-[#F0EDFA]/50 p-4">
          <p className="text-xs font-semibold text-[#0B1330]">
            First, check if the book already has a record
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">
            <strong className="text-[#3B4A86]">Fill the ISBN first</strong> when
            the book has one — scanning its barcode works too. Books without an
            ISBN can be searched by title.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              className={`${inputClass} min-w-60 flex-1`}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void runSearch();
                }
              }}
              placeholder="Scan or type the ISBN, or a title"
              autoFocus
            />
            <button
              type="button"
              className={buttonClass}
              disabled={searching || !searchQuery.trim()}
              onClick={runSearch}
            >
              {searching ? "Searching…" : "Search"}
            </button>
          </div>
        </section>
      )}

      {!linkedBook && searched && (
        matches.length > 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold text-amber-900">
              Possible existing record{matches.length > 1 ? "s" : ""}:
            </p>
            <ul className="mt-2 space-y-2">
              {matches.map((match) => (
                <li
                  key={match.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900"
                >
                  <span className="min-w-0">
                    {match.book_name}
                    {match.author ? ` · ${match.author}` : ""}
                    {match.publish_year ? ` · ${match.publish_year}` : ""}
                    {match.isbn ? ` · ISBN ${match.isbn}` : ""}
                  </span>
                  <button
                    type="button"
                    className={tableButton}
                    onClick={() => void fillFromRecord(match)}
                  >
                    Use this record
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-amber-800">
              Choosing one fills the record details below, loads its saved
              copies, and switches to adding copies to it.
            </p>
          </div>
        ) : (
          <p className="rounded-xl border border-[#BFE3D6] bg-[#E7F4EF] px-4 py-3 text-xs text-[#0B6B52]">
            No existing record found — fill the book information below to
            create a new one.
          </p>
        )
      )}

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-[#0B1330]">
          {linkedBook ? "Existing record details" : "Book information"}
        </h3>
        <fieldset
          disabled={Boolean(linkedBook)}
          className="grid gap-4 disabled:opacity-70 sm:grid-cols-2"
        >
          <Field label="Title *">
            <input
              required
              maxLength={500}
              className={inputClass}
              value={form.book_name}
              onChange={change("book_name")}
              placeholder="For example: Clean Code"
            />
          </Field>
          <Field label="Author">
            <input
              maxLength={1000}
              className={inputClass}
              value={form.author}
              onChange={change("author")}
              placeholder="For example: Robert C. Martin"
            />
          </Field>
          <Field label="ISBN (if available)">
            <input
              maxLength={100}
              className={inputClass}
              value={form.isbn}
              onChange={change("isbn")}
            />
          </Field>
          <Field label="Publisher">
            <input
              maxLength={500}
              className={inputClass}
              value={form.publisher}
              onChange={change("publisher")}
            />
          </Field>
          <Field label="Edition">
            <input
              maxLength={200}
              className={inputClass}
              value={form.edition}
              onChange={change("edition")}
            />
          </Field>
          <Field label="Publication year">
            <input
              type="number"
              min="1000"
              max="2100"
              step="1"
              className={inputClass}
              value={form.publish_year}
              onChange={change("publish_year")}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Call number">
              <input
                maxLength={200}
                className={inputClass}
                value={form.call_number}
                onChange={change("call_number")}
                placeholder="For example: QA76.76 .M37"
              />
            </Field>
          </div>
        </fieldset>
      </section>

      <section className="space-y-3 border-t border-slate-100 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#0B1330]">
            Accession numbers (physical copies)
          </h3>
          <p className="text-xs text-slate-500">
            Total copies:{" "}
            <strong className="text-[#0B1330]">{total}</strong>
          </p>
        </div>
        <p className="text-xs text-slate-500">
          {linkedBook
            ? "The record's saved copies are loaded below — edit, remove or keep them, and add new ones. A copy with loan records cannot be removed."
            : "One accession number per physical copy. A filled row counts as one copy — no separate quantity needed."}
        </p>

        {loadingCopies ? (
          <LoadingBlock label="Loading the saved copies…" className="min-h-[6rem]" />
        ) : (
          <>
            <div className="space-y-2">
              {rows.map((row, index) => (
                <div
                  key={row.key}
                  className="grid items-end gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1.3fr_1fr_auto]"
                >
                  <Field
                    label={
                      row.id
                        ? `Accession number ${index + 1} — saved copy`
                        : `Accession number ${index + 1} — new copy`
                    }
                  >
                    <input
                      className={inputClass}
                      value={row.accession_number}
                      onChange={(event) =>
                        updateRow(row.key, "accession_number", event.target.value)
                      }
                      placeholder="For example 2026-001"
                    />
                  </Field>
                  <Field label="Shelf">
                    <select
                      className={inputClass}
                      value={row.shelf_id}
                      onChange={(event) =>
                        updateRow(row.key, "shelf_id", event.target.value)
                      }
                    >
                      <option value="">No shelf</option>
                      {shelves.map((shelf) => (
                        <option key={shelf.id} value={shelf.id}>
                          {shelf.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <button
                    type="button"
                    className="pb-2.5 text-xs text-slate-500 underline hover:text-[#0B1330]"
                    onClick={() => removeRow(row.key)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <button type="button" className={secondaryButton} onClick={addRow}>
              + Add another accession number
            </button>
          </>
        )}

        <div className="flex flex-wrap items-end gap-3 rounded-xl bg-[#F7F6FB] p-3">
          <div className="min-w-44">
            <Field label="Apply to all rows — shelf">
              <select
                className={inputClass}
                value={applyShelf}
                onChange={(event) => setApplyShelf(event.target.value)}
              >
                <option value="">No shelf</option>
                {shelves.map((shelf) => (
                  <option key={shelf.id} value={shelf.id}>
                    {shelf.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <button type="button" className={secondaryButton} onClick={applyToAll}>
            Apply to all rows
          </button>
        </div>
      </section>

      <div className="sticky bottom-0 -mx-6 -mb-6 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-gradient-to-r from-[#F7F6FB] to-white px-6 py-4">
        <button
          type="button"
          disabled={saving}
          onClick={onClose}
          className={secondaryButton}
        >
          Cancel
        </button>
        <button disabled={saving || loadingCopies} className={buttonClass}>
          {saving ? "Saving…" : linkedBook ? "Save changes" : "Save book"}
        </button>
      </div>
    </form>
  );
}
