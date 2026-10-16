// The borrowing drill-down window: opens on one department, program or year
// level, shows its most borrowed books, and walks one level at a time —
// department → program → year level (or year level → program).
import { useState } from "react";
import Modal from "../ui/Modal.jsx";
import RankList from "./RankList.jsx";
import BookDetails from "../catalog/BookDetails.jsx";

const number = (value) => Number(value ?? 0).toLocaleString("en-US");

export default function BookDrillModal({ root, onClose }) {
  const [path, setPath] = useState([root]);
  const [bookId, setBookId] = useState(null);
  const current = path[path.length - 1];
  const trail = path.slice(0, -1).map((node) => node.label);

  return (
    <>
      <Modal
      title={current.label}
      description={trail.length > 0 ? trail.join(" → ") : "Most borrowed books"}
      icon={
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      }
      size="lg"
      onClose={onClose}
    >
      <div className="space-y-6 p-5 sm:p-6">
        {path.length > 1 && (
          <button
            type="button"
            className="text-xs font-semibold text-accent hover:underline"
            onClick={() => setPath(path.slice(0, -1))}
          >
            ← Back to {path[path.length - 2].label}
          </button>
        )}

        <section>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span
              aria-hidden="true"
              className="h-4 w-1 rounded-full bg-navy"
            />
            Most borrowed books
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {number(current.count)} loan{Number(current.count) === 1 ? "" : "s"} — the
            top five titles for this group.
          </p>
          <div className="mt-3">
            <RankList
              items={(current.books ?? []).map((book) => ({
                label: book.name,
                count: book.count,
                onClick: book.id ? () => setBookId(book.id) : undefined,
                actionLabel: "View details",
              }))}
              empty="No loans recorded for this group yet."
            />
          </div>
        </section>

        {current.children.length > 0 && (
          <section className="border-t border-slate-100 pt-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <span
                aria-hidden="true"
                className="h-4 w-1 rounded-full bg-navy"
              />
              {current.childrenLabel}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Open one to see its most borrowed books.
            </p>
            <ul className="mt-3 divide-y divide-slate-100">
              {current.children.map((child) => (
                <li key={child.key}>
                  <button
                    type="button"
                    className="flex w-full flex-wrap items-center justify-between gap-3 py-3 text-left transition-colors hover:bg-page/70"
                    onClick={() => setPath([...path, child])}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">
                        {child.label}
                      </span>
                      {child.sub && (
                        <span className="block truncate text-[11px] text-slate-500">
                          {child.sub}
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-3 text-xs">
                      <span className="font-semibold text-ink tabular-nums">
                        {number(child.count)}
                      </span>
                      <span className="font-semibold text-accent">
                        Open →
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Modal>
      {bookId && (
        <BookDetails id={bookId} canEdit={false} onClose={() => setBookId(null)} />
      )}
    </>
  );
}
