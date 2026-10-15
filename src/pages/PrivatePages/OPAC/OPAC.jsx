import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../../hooks/auth/useAuth.js";
import { useCatalog } from "../../../hooks/catalog/useCatalog.js";
import { ACCESS } from "../../../routes/roles.js";
import { SEARCH_FIELDS, PAGE_SIZES } from "../../../services/catalog/catalogQuery.js";
import BookCover from "../../../components/catalog/BookCover.jsx";
import BookDetails from "../../../components/catalog/BookDetails.jsx";
import EditBook from "../../../components/catalog/EditBook.jsx";
import { SkeletonCards } from "../../../components/ui/Skeleton.jsx";

const INITIAL_FILTERS = { formatId: "", shelfId: "", year: "" };
const control =
  "w-full rounded-xl border border-slate-400 bg-white px-3 py-2.5 text-xs text-[#0B1330] placeholder:text-slate-500 focus:border-[#3B4A86] focus:outline-none focus:ring-2 focus:ring-[#3B4A86]/15 disabled:opacity-50";
const labelText = "mb-1.5 block text-[11px] font-semibold text-slate-600";
const dots = {
  backgroundImage: "radial-gradient(#fff 1px, transparent 1px)",
  backgroundSize: "18px 18px",
  maskImage: "linear-gradient(to left, #000, transparent 65%)",
  WebkitMaskImage: "linear-gradient(to left, #000, transparent 65%)",
};

export default function OPAC() {
  const catalog = useCatalog();
  const { role } = useAuth();
  const canEdit = ACCESS.books.includes(role);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [selection, setSelection] = useState(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const deepBook = searchParams.get("book");
  const busy = catalog.loading || catalog.searching;
  const start = (catalog.query.page - 1) * catalog.query.pageSize + 1;

  // Deep link from the statistics: /opac?book=<id> opens that book's window.
  useEffect(() => {
    if (!deepBook || !/^\d+$/.test(deepBook)) return;
    const timer = window.setTimeout(
      () => setSelection({ id: Number(deepBook) }),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [deepBook]);

  function closeSelection() {
    setSelection(null);
    if (deepBook) navigate("/opac", { replace: true });
  }

  function setFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }
  function reset() {
    setFilters(INITIAL_FILTERS);
    catalog.clearFilters();
  }

  return (
    <>
      {/* Hero: title + search (one navy block per page) */}
      <section className="relative overflow-hidden rounded-2xl bg-[#0B1330] px-5 py-6 sm:px-8 sm:py-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          style={dots}
        />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
            <div className="min-w-0 max-w-xl">
              <p className="text-xs font-semibold text-white/60">
                Online public access catalog
              </p>
              <h1 className="mt-1.5 font-serif text-2xl font-bold tracking-tight text-white sm:text-3xl">
                OPAC
              </h1>
              <p className="mt-1.5 text-sm leading-relaxed text-white/70">
                Find books, check their library sections, and explore
                individual copies.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white">
              <span
                className={`h-1.5 w-1.5 rounded-full ${canEdit ? "bg-white" : "bg-white/50"}`}
                aria-hidden="true"
              />
              {canEdit ? "Catalog editor" : "Browse access"}
            </span>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <label className="sm:w-40">
              <span className="sr-only">Search by</span>
              <select
                aria-label="Search by"
                value={catalog.query.searchBy}
                onChange={(event) =>
                  catalog.changeFilter("searchBy", event.target.value)
                }
                className={`${control} py-3`}
              >
                {Object.entries(SEARCH_FIELDS).map(([field, label]) => (
                  <option key={field} value={field}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="relative flex-1">
              <span className="sr-only">Search catalog</span>
              <svg
                className="absolute left-3.5 top-3.5 h-4 w-4 text-[#3B4A86]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="m16 16 4 4" />
              </svg>
              <input
                type="search"
                maxLength={120}
                value={catalog.searchInput}
                onChange={(event) => catalog.setSearchInput(event.target.value)}
                placeholder={`Search by ${SEARCH_FIELDS[catalog.query.searchBy].toLowerCase()}...`}
                className={`${control} py-3 pl-10`}
              />
            </label>
          </div>
        </div>
      </section>

      {/* Filters */}
      <form
        className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(11,19,48,0.05)] sm:p-5"
        onSubmit={(event) => {
          event.preventDefault();
          catalog.applyFilters(filters);
        }}
      >
        <div className="mb-4 flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#F0EDFA] text-[#3B4A86]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
              <circle cx="16" cy="7" r="2" />
              <circle cx="8" cy="17" r="2" />
            </svg>
          </span>
          <h2 className="text-sm font-semibold text-[#0B1330]">
            Refine results
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <label>
            <span className={labelText}>Material format</span>
            <select
              aria-label="Material format"
              disabled={catalog.lookups.loading}
              value={filters.formatId}
              onChange={(event) => setFilter("formatId", event.target.value)}
              className={control}
            >
              <option value="">All formats</option>
              {catalog.lookups.formats.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelText}>Section / shelf</span>
            <select
              aria-label="Section / shelf"
              disabled={catalog.lookups.loading}
              value={filters.shelfId}
              onChange={(event) => setFilter("shelfId", event.target.value)}
              className={control}
            >
              <option value="">All sections</option>
              {catalog.lookups.shelves.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelText}>Publication year</span>
            <input
              type="number"
              min="1000"
              max="2100"
              step="1"
              value={filters.year}
              onChange={(event) => setFilter("year", event.target.value)}
              placeholder="Any year"
              className={control}
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="text-[11px] text-slate-500">
            Choose your filters, then apply them.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="text-xs font-semibold text-slate-500 hover:text-[#0B1330]"
            >
              Clear filters
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[#0B1330] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#3B4A86] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B4A86]"
            >
              Apply filters
            </button>
          </div>
        </div>
        {catalog.lookups.error && (
          <p role="alert" className="mt-3 text-xs text-red-700">
            {catalog.lookups.error}
          </p>
        )}
      </form>

      {/* Results toolbar */}
      <div className="mb-4 mt-7 flex flex-wrap items-center justify-between gap-3">
        <p
          role="status"
          className="flex items-center gap-2 text-xs font-medium text-slate-600"
        >
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${
              catalog.error
                ? "bg-red-500"
                : busy
                  ? "animate-pulse bg-[#3B4A86]/50"
                  : "bg-[#0B1330]"
            }`}
          />
          {busy
            ? "Searching the catalog..."
            : catalog.error
              ? "Catalog unavailable"
              : `${catalog.books.length} ${catalog.books.length === 1 ? "book" : "books"} on this page`}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[11px] text-slate-500">
            Sort
            <select
              aria-label="Sort"
              value={catalog.query.sort}
              onChange={(event) =>
                catalog.changeFilter("sort", event.target.value)
              }
              className={`${control} w-auto`}
            >
              <option value="title">Title A–Z</option>
              <option value="newest">Newest added</option>
              <option value="year">Publication year</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => catalog.refresh()}
            disabled={busy}
            className="rounded-xl border border-slate-400 bg-slate-100 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 hover:text-[#0B1330] disabled:opacity-40"
          >
            Refresh
          </button>
        </div>
      </div>
      <div aria-busy={busy}>
        {catalog.loading ? (
          <SkeletonCards label="Loading the catalog…" />
        ) : catalog.error ? (
          <div
            className="rounded-2xl border border-red-100 bg-red-50 p-6"
            role="alert"
          >
            <p className="text-sm font-semibold text-red-800">
              Couldn't load the catalog
            </p>
            <p className="mt-2 break-words text-xs leading-relaxed text-red-700">
              {catalog.error}
            </p>
            <button
              type="button"
              onClick={catalog.refresh}
              className="mt-4 rounded-lg border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-800 hover:bg-red-100"
            >
              Try again
            </button>
          </div>
        ) : catalog.books.length === 0 ? (
          <div className="flex min-h-60 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-[#F7F6FB]/60 px-5 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-[#F0EDFA] text-[#3B4A86]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                className="h-6 w-6"
                aria-hidden="true"
              >
                <path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z M5 17a3 3 0 0 1 3-3h10 M9 8h5" />
              </svg>
            </span>
            <h2 className="mt-4 font-serif text-xl font-bold text-[#0B1330]">
              No books found
            </h2>
            <p className="mt-2 max-w-sm text-sm text-slate-500">
              Try another search or clear the filters. A newly created catalog
              will stay empty until records are imported.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-4 rounded-xl border border-[#3B4A86]/40 bg-white px-4 py-2 text-xs font-semibold text-[#3B4A86] hover:bg-[#F0EDFA]"
            >
              Clear search and filters
            </button>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {catalog.books.map((book) => (
              <li
                key={book.id}
                className="relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 pt-5 shadow-[0_1px_2px_rgba(11,19,48,0.05)] transition-colors [contain-intrinsic-size:auto_260px] [content-visibility:auto] hover:border-[#3B4A86]/40"
              >
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-0 h-[3px] w-14 bg-[#0B1330]"
                />
                <div className="flex min-w-0 gap-3 sm:gap-4">
                  <BookCover
                    book={book}
                    className="h-28 w-20 shadow-sm sm:h-32 sm:w-24"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="inline-flex max-w-full truncate rounded-full bg-[#F0EDFA] px-2.5 py-0.5 text-[10px] font-semibold text-[#3B4A86]">
                      {book.format?.name || "Unspecified format"}
                    </span>
                    <h3 className="mt-2 line-clamp-3 break-words font-serif text-base font-bold leading-snug text-[#0B1330] sm:text-lg">
                      {book.book_name}
                    </h3>
                    <p className="mt-1.5 line-clamp-2 text-xs text-slate-500">
                      {book.author || "Author not recorded"}
                    </p>
                  </div>
                </div>
                <dl className="mt-4 grid flex-1 grid-cols-2 gap-x-3 gap-y-2.5 break-words border-t border-slate-100 pt-3">
                  <div className="col-span-2">
                    <dt className="text-[10px] text-slate-400">Section</dt>
                    <dd className="line-clamp-2 text-xs font-medium text-[#0B1330]/85">
                      {book.section?.name || "Not recorded"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-slate-400">Published</dt>
                    <dd className="text-xs font-medium text-[#0B1330]/85">
                      {book.publish_year || "Not recorded"}
                      {book.edition ? ` · ${book.edition}` : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] text-slate-400">Call number</dt>
                    <dd className="text-xs font-medium text-[#0B1330]/85">
                      {book.call_number || "Not recorded"}
                    </dd>
                  </div>
                </dl>
                <button
                  type="button"
                  onClick={() => setSelection({ id: book.id })}
                  className="mt-4 flex items-center justify-between rounded-xl border border-[#0B1330]/15 px-3 py-2.5 text-xs font-semibold text-[#0B1330] hover:border-[#0B1330] hover:bg-[#0B1330] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B4A86]"
                >
                  <span>
                    View details
                    <span className="sr-only"> for {book.book_name}</span>
                  </span>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    className="h-3.5 w-3.5"
                  >
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <nav
        aria-label="Catalog pagination"
        className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-5"
      >
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
          <label className="flex items-center gap-2">
            Per page
            <select
              aria-label="Per page"
              value={catalog.query.pageSize}
              onChange={(event) =>
                catalog.changeFilter("pageSize", Number(event.target.value))
              }
              className={`${control} w-auto`}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          {!busy && catalog.books.length > 0 && (
            <span>
              Showing {start}–{start + catalog.books.length - 1}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy || catalog.query.page === 1}
            onClick={() => catalog.setPage(catalog.query.page - 1)}
            className="rounded-xl border border-slate-400 bg-slate-100 px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 hover:text-[#0B1330] disabled:opacity-40"
          >
            Previous
          </button>
          <span
            aria-current="page"
            className="grid h-9 min-w-9 place-items-center rounded-xl bg-[#0B1330] px-3 text-xs font-semibold text-white"
          >
            {catalog.query.page}
          </span>
          <button
            type="button"
            disabled={busy || !catalog.hasNext}
            onClick={() => catalog.setPage(catalog.query.page + 1)}
            className="rounded-xl border border-slate-400 bg-slate-100 px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 hover:text-[#0B1330] disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </nav>

      {selection &&
        (selection.book && canEdit ? (
          <EditBook
            key={`edit-${selection.id}`}
            book={selection.book}
            role={role}
            lookups={catalog.lookups}
            onClose={closeSelection}
            onSaved={() => {
              closeSelection();
              catalog.refresh();
            }}
          />
        ) : (
          <BookDetails
            key={`details-${selection.id}`}
            id={selection.id}
            canEdit={canEdit}
            onClose={closeSelection}
            onEdit={(book) => {
              if (canEdit) setSelection({ id: book.id, book });
            }}
          />
        ))}
    </>
  );
}
