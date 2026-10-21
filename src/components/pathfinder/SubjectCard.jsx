// One subject in the curriculum: the course chip, title, units and
// prerequisites, the recommended books with live availability, and the role
// actions — librarians add books, faculty suggest them.
//
// The book list starts collapsed (first three) so a subject with a long
// reading list stays compact; "View all" opens the full list in a window.
// "View book" opens the book's window in place (no navigation, no lost
// scroll).
import { useState } from "react";
import BookCover from "../catalog/BookCover.jsx";
import Modal from "../ui/Modal.jsx";
import { secondaryButton } from "../attendance/WorkspaceUi.jsx";

const COLLAPSED_BOOKS = 3;

function BooksIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

const primarySmall =
  "inline-flex items-center justify-center rounded-lg bg-navy px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong disabled:opacity-40";
const secondarySmall =
  "inline-flex items-center justify-center rounded-lg border border-slate-400 bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-200 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong disabled:opacity-40";

function metaLine(subject) {
  const parts = [];
  if (subject.units != null) {
    parts.push(`${subject.units} ${subject.units === 1 ? "unit" : "units"}`);
    const hours = [];
    if (subject.lec_hours) hours.push(`${subject.lec_hours} lec`);
    if (subject.lab_hours) hours.push(`${subject.lab_hours} lab`);
    if (hours.length) parts.push(hours.join(" + "));
    if (subject.prerequisites) parts.push(`Prereq: ${subject.prerequisites}`);
  }
  if (subject.is_general_education) {
    parts.push(
      subject.program_count
        ? `General education · ${subject.program_count} programs`
        : "General education",
    );
  }
  return parts.join(" · ");
}

function BookRow({ book, canCurate, onRemove, onOpenBook }) {
  const out = Number(book.available) === 0;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
      <BookCover book={book} className="h-14 w-10 shrink-0 rounded-md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-ink">
          {book.book_name}
        </p>
        <p className="truncate text-[11px] text-slate-500">{book.author}</p>
        <p className="mt-0.5 truncate text-[10px] text-slate-400">
          {[book.call_number, book.shelf].filter(Boolean).join(" · ")}
        </p>
        {book.note && (
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            {book.note}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            out
              ? "bg-amber-50 text-amber-800"
              : "bg-jade-soft text-jade-deep"
          }`}
        >
          {out ? "All copies out" : `${book.available} of ${book.copies} available`}
        </span>
        <span className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
          {book.source === "faculty" && (
            <span className="rounded-full bg-tint px-2 py-0.5 text-[10px] font-semibold text-accent">
              Faculty pick
            </span>
          )}
          <button
            type="button"
            onClick={() => onOpenBook(book.book_id)}
            className="inline-flex items-center rounded-lg border border-slate-400 bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700 transition-colors hover:border-navy hover:bg-navy hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
          >
            View book
          </button>
          {canCurate && (
            <button
              type="button"
              onClick={() => onRemove(book)}
              className="text-[11px] font-semibold text-slate-500 transition-colors hover:text-red-700"
            >
              Remove
            </button>
          )}
        </span>
      </div>
    </li>
  );
}

// The full reading list for one subject, in a window: every recommended
// book with its availability, so long lists never stretch the curriculum.
function SubjectBooksModal({
  subject,
  books,
  canCurate,
  onRemove,
  onOpenBook,
  onClose,
}) {
  return (
    <Modal
      title="Recommended books"
      description={`${subject.course_code} · ${subject.course_title} — all ${books.length} books on this subject's list.`}
      icon={<BooksIcon />}
      size="lg"
      onClose={onClose}
      footer={
        <div className="flex justify-end">
          <button type="button" className={secondaryButton} onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      <ul className="m-5 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-surface">
        {books.map((book) => (
          <BookRow
            key={book.recommendation_id}
            book={book}
            canCurate={canCurate}
            onRemove={(picked) => onRemove(subject, picked)}
            onOpenBook={onOpenBook}
          />
        ))}
      </ul>
    </Modal>
  );
}

export default function SubjectCard({
  subject,
  canCurate,
  canSuggest,
  onAdd,
  onSuggest,
  onRemove,
  onOpenBook,
  onAiPicks,
}) {
  const [listOpen, setListOpen] = useState(false);
  const books = subject.books ?? [];
  const pending = Number(subject.pending_count ?? 0);
  const myPending = subject.my_pending ?? null;
  const visibleBooks = books.slice(0, COLLAPSED_BOOKS);

  return (
    <div className="rounded-2xl border border-slate-200 bg-surface p-4 shadow-[0_1px_2px_rgba(11,19,48,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-tint px-2 py-0.5 text-[11px] font-bold tracking-wide text-accent">
              {subject.course_code}
            </span>
            <h3 className="min-w-0 text-sm font-semibold text-ink">
              {subject.course_title}
            </h3>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">{metaLine(subject)}</p>
          {subject.remarks && (
            <p className="mt-1 text-[11px] text-amber-800">{subject.remarks}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canCurate && pending > 0 && (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-800">
              {pending} to review
            </span>
          )}
          {canSuggest && !myPending && (
            <button
              type="button"
              className={secondarySmall}
              onClick={() => onSuggest(subject)}
            >
              Suggest a book
            </button>
          )}
          {canCurate && (
            <button
              type="button"
              className={secondarySmall}
              onClick={() => onAiPicks(subject)}
              title="Ask the AI for recommendations (with web sources) — the result is saved for next time"
            >
              AI picks
            </button>
          )}
          {canCurate && (
            <button
              type="button"
              className={primarySmall}
              onClick={() => onAdd(subject)}
            >
              Add a book
            </button>
          )}
        </div>
      </div>

      {myPending && (
        <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
          Your suggestion “{myPending.book_name}” is waiting for a librarian's
          review.
        </p>
      )}

      {books.length > 0 ? (
        <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
          {visibleBooks.map((book) => (
            <BookRow
              key={book.recommendation_id}
              book={book}
              canCurate={canCurate}
              onRemove={(picked) => onRemove(subject, picked)}
              onOpenBook={onOpenBook}
            />
          ))}
          {books.length > COLLAPSED_BOOKS && (
            <li>
              <button
                type="button"
                onClick={() => setListOpen(true)}
                className="w-full bg-page/60 px-3 py-2.5 text-[11px] font-semibold text-accent transition-colors hover:bg-tint/60"
              >
                View all {books.length} books
              </button>
            </li>
          )}
        </ul>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-page/60 px-3 py-2.5 text-[11px] text-slate-500">
          No recommended books yet
          {canSuggest
            ? " — suggest one from the catalog."
            : canCurate
              ? " — add books from the catalog."
              : "."}
        </p>
      )}

      {listOpen && (
        <SubjectBooksModal
          subject={subject}
          books={books}
          canCurate={canCurate}
          onRemove={onRemove}
          onOpenBook={onOpenBook}
          onClose={() => setListOpen(false)}
        />
      )}
    </div>
  );
}
