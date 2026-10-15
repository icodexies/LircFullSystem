import { useEffect, useState } from "react";
import { getBook, getBookCopies } from "../../services/catalog/bookService.js";
import CatalogDialog from "./CatalogDialog.jsx";
import BookCover from "./BookCover.jsx";
import { Spinner, LoadingBlock } from "../ui/Loading.jsx";
import { buttonClass } from "../attendance/StaffUi.jsx";
import { secondaryButton } from "../attendance/WorkspaceUi.jsx";

const CATALOG_INFO = [
  ["ISBN", "isbn"],
  ["Call number", "call_number"],
  ["Publication year", "publish_year"],
  ["Edition", "edition"],
  ["Publisher", "publisher"],
  ["Place of publication", "place_of_publication"],
];
const INVENTORY_TAGS = [
  ["Barcode tag", "barcode_tag_number"],
  ["Asset number", "asset_number"],
];

function Fields({ title, rows, book }) {
  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
        <span
          aria-hidden="true"
          className="h-4 w-1 rounded-full bg-navy"
        />
        {title}
      </h3>
      <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {rows.map(([label, field]) => (
          <div key={field} className="rounded-xl bg-page px-3.5 py-3">
            <dt className="text-[11px] text-slate-600">{label}</dt>
            <dd className="mt-0.5 break-words text-sm font-medium text-ink">
              {book[field] || (
                <span className="font-normal text-slate-500">Not recorded</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function BookDetails({ id, canEdit, onEdit, onClose }) {
  const [detail, setDetail] = useState({ book: null, error: "" });
  const [page, setPage] = useState(1);
  const [copies, setCopies] = useState({
    page: 0,
    rows: [],
    hasNext: false,
    error: "",
  });
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getBook(id, controller.signal)
      .then((book) => {
        if (active) setDetail({ book, error: "" });
      })
      .catch(() => {
        if (active)
          setDetail({
            book: null,
            error:
              "Couldn't load this book. It may have been removed, or the connection failed.",
          });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [id]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getBookCopies(id, page, controller.signal)
      .then((data) => {
        if (active)
          setCopies({
            page,
            rows: data.copies,
            hasNext: data.hasNext,
            error: "",
          });
      })
      .catch(() => {
        if (active)
          setCopies({
            page,
            rows: [],
            hasNext: false,
            error: "Couldn't load copy records.",
          });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [id, page]);

  const { book, error } = detail;
  const loadingCopies = copies.page !== page;
  return (
    <CatalogDialog
      title="Book details"
      description={book?.book_name}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <button type="button" onClick={onClose} className={secondaryButton}>
            Close
          </button>
          {book && canEdit && (
            <button
              type="button"
              onClick={() => onEdit(book)}
              className={buttonClass}
            >
              Edit book record
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-7 p-6">
        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </p>
        ) : !book ? (
          <LoadingBlock label="Loading book details…" className="min-h-[16rem]" />
        ) : (
          <>
            {/* Identity */}
            <div className="rounded-2xl border border-slate-200 bg-page p-5 sm:p-6">
              <div className="flex gap-4 sm:gap-5">
                <BookCover
                  book={book}
                  size="L"
                  className="h-36 w-24 border-slate-200 shadow-md sm:h-40 sm:w-28"
                />
                <div className="min-w-0 flex-1">
                  <span className="inline-flex max-w-full truncate rounded-full bg-tint px-2.5 py-0.5 text-[11px] font-semibold text-accent">
                    {book.format?.name || "Unspecified format"}
                  </span>
                  <h3 className="mt-2.5 break-words font-serif text-xl font-bold leading-snug text-ink sm:text-2xl">
                    {book.book_name}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    {book.author || "Author not recorded"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {book.section?.name || "Section not recorded"}
                  </p>
                </div>
              </div>
            </div>

            <Fields
              title="Catalog information"
              rows={CATALOG_INFO}
              book={book}
            />
            <Fields title="Inventory tags" rows={INVENTORY_TAGS} book={book} />
          </>
        )}

        <section
          className="border-t border-slate-200 pt-6"
          aria-labelledby="opac-copies-title"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3
              id="opac-copies-title"
              className="flex items-center gap-2 text-sm font-semibold text-ink"
            >
              <span
                aria-hidden="true"
                className="h-4 w-1 rounded-full bg-navy"
              />
              Physical copies
            </h3>
            {!loadingCopies && !copies.error && copies.rows.length > 0 && (
              <span className="rounded-full bg-tint px-2.5 py-0.5 text-[11px] font-semibold text-accent">
                {copies.rows.length} on this page
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Each accession number identifies one physical copy.
          </p>
          {loadingCopies ? (
            <div role="status" className="mt-4 flex items-center gap-2 text-sm text-slate-500">
              <Spinner size="sm" /> Loading copies...
            </div>
          ) : copies.error ? (
            <p role="alert" className="mt-4 text-sm text-red-700">
              {copies.error}
            </p>
          ) : copies.rows.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-500">
              No copy records on this page.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-surface">
              {copies.rows.map((copy) => {
                const available = copy.status === "Available";
                return (
                  <li
                    key={copy.id}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-xs"
                  >
                    <span className="break-all font-semibold text-ink">
                      {copy.accession_number}
                    </span>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${available ? "bg-jade-soft text-jade-deep" : "bg-slate-100 text-slate-600"}`}
                    >
                      <span
                        aria-hidden="true"
                        className={`h-1.5 w-1.5 rounded-full ${available ? "bg-jade" : "bg-slate-400"}`}
                      />
                      {copy.status}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-4 flex items-center justify-between gap-2 text-xs">
            <button
              type="button"
              disabled={page === 1 || loadingCopies}
              onClick={() => setPage((value) => value - 1)}
              className="rounded-xl border border-slate-400 bg-slate-100 px-3.5 py-2 font-semibold text-slate-700 hover:bg-slate-200 hover:text-ink disabled:opacity-40"
            >
              Previous copies
            </button>
            <span
              aria-current="page"
              className="grid h-8 min-w-8 place-items-center rounded-lg bg-navy px-2.5 font-semibold text-white"
            >
              {page}
            </span>
            <button
              type="button"
              disabled={
                loadingCopies || !copies.hasNext || Boolean(copies.error)
              }
              onClick={() => setPage((value) => value + 1)}
              className="rounded-xl border border-slate-400 bg-slate-100 px-3.5 py-2 font-semibold text-slate-700 hover:bg-slate-200 hover:text-ink disabled:opacity-40"
            >
              Next copies
            </button>
          </div>
        </section>
      </div>
    </CatalogDialog>
  );
}
