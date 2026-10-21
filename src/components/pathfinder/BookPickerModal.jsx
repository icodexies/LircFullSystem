// The book picker for one subject: search the catalog, pick a title, add a
// short note. Librarians add the book straight to the subject's list;
// faculty send a suggestion that librarians review. One modal, two modes.
import { useEffect, useMemo, useState } from "react";
import Modal from "../ui/Modal.jsx";
import { Spinner } from "../ui/Loading.jsx";
import BookCover from "../catalog/BookCover.jsx";
import { getBooks } from "../../services/catalog/bookService.js";
import {
  addRecommendation,
  suggestBook,
} from "../../services/pathfinder/pathFinderService.js";
import { useToast } from "../../hooks/shared/useToast.js";
import { secondaryButton } from "../attendance/WorkspaceUi.jsx";
import { buttonClass, inputClass } from "../attendance/StaffUi.jsx";

const SEARCH_DEBOUNCE_MS = 350;

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export default function BookPickerModal({
  subject,
  mode = "add",
  existingBookIds = [],
  onClose,
  onDone,
}) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState({ key: "", books: [], error: "" });
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // Debounce the search so typing does not refetch on every key press.
  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebounced(query.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!debounced) return;
    const controller = new AbortController();
    let active = true;
    const key = debounced;
    getBooks(
      {
        page: 1,
        pageSize: 10,
        search: debounced,
        searchBy: "book_name",
        formatId: "",
        shelfId: "",
        year: "",
        sort: "title",
      },
      controller.signal,
    )
      .then(({ books }) => {
        if (active) setResults({ key, books, error: "" });
      })
      .catch((error) => {
        if (active && error.name !== "AbortError")
          setResults({ key, books: [], error: error.message });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [debounced]);

  // The results still belong to an older query while the next one loads.
  const searching = debounced !== "" && results.key !== debounced;
  const shown = results.key === debounced ? results : { books: [], error: "" };

  const existing = useMemo(() => new Set(existingBookIds), [existingBookIds]);

  async function submit() {
    if (!selected || busy) return;
    setBusy(true);
    const genEdId = subject.gen_ed_subject_id ?? null;
    try {
      if (mode === "add") {
        await addRecommendation(
          subject.course_code,
          selected.id,
          note,
          genEdId,
        );
        toast.success(
          subject.is_general_education
            ? `“${selected.book_name}” is now recommended for ${subject.course_title}, in every program.`
            : `“${selected.book_name}” is now recommended for ${subject.course_code}.`,
        );
      } else {
        await suggestBook(subject.course_code, selected.id, note, genEdId);
        toast.success("Suggestion sent — a librarian will review it.");
      }
      onDone();
      onClose();
    } catch (error) {
      toast.error(error.message);
      setBusy(false);
    }
  }

  const addMode = mode === "add";

  return (
    <Modal
      title={addMode ? "Add a recommended book" : "Suggest a book"}
      description={`${subject.course_code} — ${subject.course_title}`}
      icon={<SearchIcon />}
      size="lg"
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
            className={buttonClass}
            onClick={submit}
            disabled={!selected || busy}
          >
            {busy && <Spinner size="sm" />}
            {addMode ? "Add recommendation" : "Send suggestion"}
          </button>
        </div>
      }
    >
      <div className="space-y-4 px-5 py-4 sm:px-6">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-600">
            Search the catalog
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            data-modal-autofocus="true"
            placeholder="Type a book title…"
            className={inputClass}
          />
        </label>

        {searching && (
          <div
            className="flex items-center gap-2 text-xs text-slate-500"
            role="status"
          >
            <Spinner size="sm" /> Searching the catalog…
          </div>
        )}
        {!searching && shown.error && (
          <p className="rounded-xl bg-red-50 p-3 text-xs text-red-700" role="alert">
            {shown.error}
          </p>
        )}

        {!searching && !shown.error && debounced && !shown.books.length && (
          <p className="rounded-xl border border-dashed border-slate-200 bg-page/60 px-4 py-6 text-center text-xs text-slate-500">
            No books match “{debounced}”. Try another word.
          </p>
        )}
        {!debounced && (
          <p className="rounded-xl border border-dashed border-slate-200 bg-page/60 px-4 py-6 text-center text-xs text-slate-500">
            {addMode
              ? "Search for the book to put on this subject's list."
              : "Search for the book you want to recommend to the librarians."}
          </p>
        )}

        {shown.books.length > 0 && (
          <ul className="space-y-2">
            {shown.books.map((book) => {
              const already = existing.has(book.id);
              const isSelected = selected?.id === book.id;
              return (
                <li key={book.id}>
                  <button
                    type="button"
                    disabled={already}
                    onClick={() => setSelected(book)}
                    aria-pressed={isSelected}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                      isSelected
                        ? "border-accent-strong bg-tint/60"
                        : "border-slate-200 bg-surface hover:bg-page"
                    } ${already ? "cursor-not-allowed opacity-60" : ""}`}
                  >
                    <BookCover book={book} className="h-12 w-9 shrink-0 rounded" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-ink">
                        {book.book_name}
                      </span>
                      <span className="block truncate text-[11px] text-slate-500">
                        {book.author}
                      </span>
                      {book.call_number && (
                        <span className="block text-[10px] text-slate-400">
                          {book.call_number}
                        </span>
                      )}
                    </span>
                    {already ? (
                      <span className="shrink-0 rounded-full bg-jade-soft px-2 py-0.5 text-[10px] font-semibold text-jade-deep">
                        On the list
                      </span>
                    ) : isSelected ? (
                      <span className="shrink-0 rounded-full bg-navy px-2 py-0.5 text-[10px] font-semibold text-white">
                        Selected
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <label className="block">
          <span className="mb-1 block text-xs text-slate-600">
            {addMode ? "Note for students (optional)" : "Why this book? (optional)"}
          </span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={300}
            rows={2}
            placeholder={
              addMode
                ? "A short line about how this book supports the subject"
                : "Tell the librarians why this book fits the subject"
            }
            className="w-full rounded-xl border border-slate-400 bg-surface px-3 py-2.5 text-xs text-ink placeholder:text-slate-500 focus:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent-strong/15"
          />
        </label>
      </div>
    </Modal>
  );
}
