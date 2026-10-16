// My Borrowing (members): the reader's own circulation records — books still
// out, anything overdue, and everything returned. Filters (status, search)
// and paging run on the server; the payload only ever contains the caller's
// own loans.
import { useEffect, useState } from "react";
import { useAuth } from "../../../hooks/auth/useAuth.js";
import { getMyLoans } from "../../../services/borrow/borrowService.js";
import { rowStatusLabel } from "../../../services/borrow/borrowReportRules.js";
import { displayTime } from "../../../services/attendance/attendanceRules.js";
import { inputClass } from "../../../components/attendance/StaffUi.jsx";
import {
  StatusBadge,
  SummaryCards,
  WorkspaceHeader,
  WorkspaceNotice,
  WorkspacePanel,
  secondaryButton,
} from "../../../components/attendance/WorkspaceUi.jsx";
import EmptyState from "../../../components/personnel/EmptyState.jsx";
import BookDetails from "../../../components/catalog/BookDetails.jsx";
import { Spinner } from "../../../components/ui/Loading.jsx";

const PAGE_SIZE = 20;
const GRID =
  "md:grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_150px_150px_150px_175px]";

const STATUS_FILTERS = [
  ["all", "All"],
  ["open", "Still out"],
  ["overdue", "Overdue"],
  ["returned", "Returned"],
];

// One loan's state, in the same wording the Book Borrow report uses.
function statusBadge(row) {
  if (!row.returned_at) {
    return row.is_overdue ? (
      <StatusBadge tone="danger">{rowStatusLabel(row)}</StatusBadge>
    ) : (
      <StatusBadge tone="success">Still out</StatusBadge>
    );
  }
  return row.days_late != null && row.days_late >= 0 ? (
    <StatusBadge tone="warning">{rowStatusLabel(row)}</StatusBadge>
  ) : (
    <StatusBadge tone="muted">Returned</StatusBadge>
  );
}

function FilterChip({ active, onClick, children, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-semibold transition-colors ${
        active
          ? "bg-navy text-white"
          : "border border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-ink"
      }`}
    >
      {children}
      {count != null && (
        <span
          className={`rounded-full px-1.5 text-[10px] font-bold tabular-nums ${
            active ? "bg-white/20 text-white" : "bg-surface text-slate-500"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export default function MyBorrowing() {
  const { profile } = useAuth();
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ key: "", data: null, error: "" });
  const [bookId, setBookId] = useState(null);

  const key = `${status}|${search.trim()}|${page}|${revision}`;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getMyLoans({
      status,
      search: search.trim(),
      page,
      pageSize: PAGE_SIZE,
      signal: controller.signal,
    })
      .then((result) => {
        if (active) setState({ key, data: result, error: "" });
      })
      .catch((problem) => {
        if (!active) return;
        if (
          problem?.name === "AbortError" ||
          /abort/i.test(String(problem?.message ?? ""))
        )
          return;
        setState((current) => ({
          ...current,
          key,
          error: problem?.message || "Your records could not be loaded.",
        }));
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [status, search, page, revision, key]);

  const loading = state.key !== key;
  const data = state.data;
  const error = state.key === key ? state.error : "";
  const totals = data?.totals ?? {};
  const rows = data?.rows ?? [];
  const total = Number(data?.total ?? 0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const lateReturns = Number(totals.late_returns ?? 0);
  const onTime = Math.max(0, Number(totals.returned ?? 0) - lateReturns);
  const hasFilters = status !== "all" || Boolean(search.trim());

  function pickStatus(value) {
    setStatus(value);
    setPage(1);
  }

  function clearFilters() {
    setStatus("all");
    setSearch("");
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <WorkspaceHeader
        title="My Borrowing"
        description="Your circulation records — the books you have out, anything overdue, and everything returned."
        actions={
          <button
            type="button"
            className={secondaryButton}
            disabled={loading}
            onClick={() => setRevision((value) => value + 1)}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        }
      >
        <span>
          Library card{" "}
          <strong className="font-semibold text-white">
            {profile?.library_id ?? "—"}
          </strong>{" "}
          — return books at the circulation desk by the due date.
        </span>
        {loading && data && (
          <div
            role="status"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white"
          >
            <Spinner size="sm" /> Updating…
          </div>
        )}
      </WorkspaceHeader>

      {error && <WorkspaceNotice error>{error}</WorkspaceNotice>}

      <SummaryCards
        loading={loading && !data}
        items={[
          {
            label: "Still out",
            value: totals.open,
            help: "Books with you right now",
          },
          {
            label: "Overdue",
            value: totals.overdue,
            help: "Still out past the due date",
            tone: "warning",
          },
          {
            label: "Returned",
            value: totals.returned,
            help: data
              ? `${lateReturns.toLocaleString("en-US")} late · ${onTime.toLocaleString("en-US")} on time`
              : "Books you have returned",
          },
          {
            label: "Total loans",
            value: totals.all,
            help: "Every record on your card",
          },
        ]}
      />

      <WorkspacePanel
        title="My circulation records"
        description="Newest first — filter by state or search a title, author or accession number."
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-3 border-b border-slate-200 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_FILTERS.map(([value, label]) => (
              <FilterChip
                key={value}
                active={status === value}
                count={data ? Number(totals[value] ?? 0) : null}
                onClick={() => pickStatus(value)}
              >
                {label}
              </FilterChip>
            ))}
          </div>
          <div className="flex min-w-[220px] flex-1 items-center gap-2">
            <input
              className={inputClass}
              type="search"
              placeholder="Search a title, author or accession number…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            {hasFilters && (
              <button
                type="button"
                className="shrink-0 text-xs font-semibold text-accent hover:underline"
                onClick={clearFilters}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div
          className={`hidden gap-x-4 border-b border-slate-200 bg-page px-5 py-2.5 text-[11px] font-semibold text-slate-600 md:grid ${GRID}`}
        >
          <span>Book</span>
          <span>Accession</span>
          <span>Borrowed</span>
          <span>Due</span>
          <span>Returned</span>
          <span>Status</span>
        </div>

        {!loading && rows.length === 0 ? (
          <div className="p-5">
            {hasFilters ? (
              <EmptyState
                title="No loans match this filter."
                description="Try another state or clear the filters to see every record."
              />
            ) : (
              <EmptyState
                title="No borrowing records yet."
                description="Books you borrow will appear here — find one in the OPAC."
              />
            )}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((row) => (
              <li
                key={row.id}
                className={`grid grid-cols-1 gap-x-4 gap-y-2 px-5 py-3.5 text-xs md:items-center ${GRID}`}
              >
                <span className="min-w-0">
                  <button
                    type="button"
                    onClick={() => row.book_id && setBookId(row.book_id)}
                    className="block max-w-full truncate text-left font-semibold text-ink transition-colors hover:text-accent"
                  >
                    {row.book_name}
                  </button>
                  <span className="block truncate text-[11px] text-slate-500">
                    {row.author || "Author not recorded"}
                  </span>
                </span>
                <span className="min-w-0 text-slate-500">
                  {row.accession_number}
                  {row.call_number && (
                    <span className="block text-[11px] text-slate-400">
                      {row.call_number}
                    </span>
                  )}
                </span>
                <span className="text-slate-500">
                  {displayTime(row.borrowed_at)}
                </span>
                <span
                  className={
                    row.is_overdue
                      ? "font-medium text-red-700"
                      : "text-slate-500"
                  }
                >
                  {displayTime(row.due_at)}
                </span>
                <span className="text-slate-500">
                  {row.returned_at ? displayTime(row.returned_at) : "—"}
                </span>
                <span>{statusBadge(row)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
          <p className="text-xs text-slate-500">
            {loading && !data
              ? "Loading…"
              : `${total.toLocaleString("en-US")} record${total === 1 ? "" : "s"} · page ${page} of ${pages}`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className={secondaryButton}
              disabled={page === 1 || loading}
              onClick={() => setPage((value) => value - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className={secondaryButton}
              disabled={page >= pages || loading}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </WorkspacePanel>

      {bookId && (
        <BookDetails id={bookId} canEdit={false} onClose={() => setBookId(null)} />
      )}
    </div>
  );
}
