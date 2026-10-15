// Review tab: the copies with no scan yet in this inventory. Copies on loan
// show as Borrowed; staff investigate the rest and confirm the ones they
// cannot find as Missing (and can undo it until the inventory is finished).
import { useEffect, useState } from "react";
import { useToast } from "../../hooks/shared/useToast.js";
import {
  getUnscanned,
  setCopyMissing,
} from "../../services/inventory/inventoryService.js";
import { deriveReviewState } from "../../services/inventory/inventoryRules.js";
import {
  inputClass,
  buttonClass,
  tableButton,
} from "../attendance/StaffUi.jsx";
import {
  WorkspacePanel,
  StatusBadge,
  secondaryButton,
} from "../attendance/WorkspaceUi.jsx";
import { LoadingBlock } from "../ui/Loading.jsx";

const PAGE_SIZE = 50;

export default function ReviewTab({ session, onCounts }) {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let active = true;
    getUnscanned(session.id, { search: query, page, pageSize: PAGE_SIZE })
      .then((data) => {
        if (!active) return;
        setRows(data?.rows ?? []);
        setTotal(data?.total ?? 0);
        setHasNext(Boolean(data?.has_next));
        setError("");
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session.id, query, page, revision]);

  function beginLoad() {
    setLoading(true);
    setError("");
  }

  function runSearch(event) {
    event.preventDefault();
    beginLoad();
    setPage(1);
    setQuery(search.trim());
    setRevision((value) => value + 1);
  }

  function goToPage(next) {
    beginLoad();
    setPage(next);
  }

  async function toggleMissing(row) {
    if (busyId) return;
    setBusyId(row.accession_id);
    try {
      const data = await setCopyMissing(
        session.id,
        row.accession_id,
        !row.missing,
      );
      setRows((current) =>
        current.map((item) =>
          item.accession_id === row.accession_id
            ? { ...item, missing: !row.missing }
            : item,
        ),
      );
      onCounts(data.counts);
      toast.success(
        row.missing
          ? `${row.accession_number} is no longer marked missing.`
          : `${row.accession_number} marked as missing.`,
      );
    } catch (err) {
      toast.error(err.message, "Not saved");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <WorkspacePanel
      title="Not yet checked"
      description="Copies with no scan yet in this inventory. Copies on loan show as Borrowed — investigate the rest before marking any as missing."
      actions={
        <button
          type="button"
          className={secondaryButton}
          disabled={loading}
          onClick={() => {
            beginLoad();
            setRevision((value) => value + 1);
          }}
        >
          Refresh
        </button>
      }
    >
      <form
        onSubmit={runSearch}
        className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:px-6"
      >
        <input
          type="search"
          className={`${inputClass} flex-1`}
          maxLength="120"
          placeholder="Search an accession number or title…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button type="submit" className={buttonClass}>
          Search
        </button>
      </form>

      <div className="px-5 py-4 sm:px-6">
        {loading ? (
          <LoadingBlock label="Loading copies…" className="min-h-[10rem]" />
        ) : error ? (
          <p
            role="alert"
            className="rounded-xl border border-red-100 bg-red-50 p-4 text-xs text-red-700"
          >
            {error}
          </p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-500">
            {query
              ? "No copies match this search."
              : "Every copy has been checked. Nothing is left to review."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((row) => {
              const state = deriveReviewState(row);
              return (
                <li
                  key={row.accession_id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">
                      {row.accession_number}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {row.book_name}
                    </p>
                    {!row.missing && row.condition === "Missing" && (
                      <p className="mt-0.5 text-[11px] text-amber-700">
                        Was recorded missing in an earlier inventory.
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
                    {row.missing ? (
                      <button
                        type="button"
                        className={tableButton}
                        disabled={busyId === row.accession_id}
                        onClick={() => toggleMissing(row)}
                      >
                        Undo
                      </button>
                    ) : state.canMark ? (
                      <button
                        type="button"
                        className={tableButton}
                        disabled={busyId === row.accession_id}
                        onClick={() => toggleMissing(row)}
                      >
                        Mark as missing
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <nav
        aria-label="Review list pagination"
        className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-[11px] text-slate-500 sm:px-6"
      >
        <span>
          Page {page} · {total.toLocaleString()}{" "}
          {total === 1 ? "copy" : "copies"} not found yet
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className={tableButton}
            disabled={loading || page === 1}
            onClick={() => goToPage(page - 1)}
          >
            Previous
          </button>
          <button
            type="button"
            className={tableButton}
            disabled={loading || !hasNext}
            onClick={() => goToPage(page + 1)}
          >
            Next
          </button>
        </div>
      </nav>
    </WorkspacePanel>
  );
}
