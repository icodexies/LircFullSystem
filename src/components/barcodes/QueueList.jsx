// The waiting barcode queue, one page at a time (newest first), in a fixed
// height so it sits side by side with the template list. A wrong number can
// be removed while it is still in the queue.
import { useEffect, useState } from "react";
import { useToast } from "../../hooks/shared/useToast.js";
import {
  getBarcodeQueue,
  removeBarcodeNumber,
} from "../../services/barcodes/barcodeService.js";
import { displayTime } from "../../services/attendance/attendanceRules.js";
import {
  WorkspacePanel,
  secondaryButton,
} from "../attendance/WorkspaceUi.jsx";
import { tableButton } from "../attendance/StaffUi.jsx";
import { SkeletonRows } from "../ui/Skeleton.jsx";

const PAGE_SIZE = 6;

export default function QueueList({ onCounts }) {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState(null);

  useEffect(() => {
    let active = true;
    getBarcodeQueue({ page, pageSize: PAGE_SIZE })
      .then((data) => {
        if (!active) return;
        const nextRows = data?.rows ?? [];
        // Removing the last row of the last page steps back one page.
        if (nextRows.length === 0 && page > 1) {
          setPage((value) => Math.max(value - 1, 1));
          return;
        }
        setRows(nextRows);
        setTotal(data?.total ?? 0);
        setHasNext(Boolean(data?.has_next));
        setError("");
      })
      .catch((err) => {
        if (!active) return;
        setRows([]);
        setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [page, revision]);

  function beginLoad() {
    setRows(null);
    setError("");
  }

  function goToPage(next) {
    beginLoad();
    setPage(next);
  }

  function refresh() {
    beginLoad();
    setRevision((value) => value + 1);
  }

  async function remove(entry) {
    if (removingId) return;
    setRemovingId(entry.id);
    try {
      const result = await removeBarcodeNumber(entry.id);
      toast.success(`${entry.accession_number} removed from the queue.`);
      onCounts?.(result?.counts);
      refresh();
    } catch (err) {
      toast.error(err.message, "Not removed");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <WorkspacePanel
      title="In the queue"
      description={
        rows === null
          ? "Loading the waiting numbers…"
          : `${total.toLocaleString()} number${total === 1 ? "" : "s"} waiting for a template.`
      }
      actions={
        <button
          type="button"
          className={secondaryButton}
          disabled={rows === null}
          onClick={refresh}
        >
          Refresh
        </button>
      }
    >
      <div className="h-96 overflow-y-auto">
        {error ? (
          <p role="alert" className="px-5 py-4 text-xs text-red-700 sm:px-6">
            {error}
          </p>
        ) : rows === null ? (
          <SkeletonRows count={5} label="Loading the queue…" />
        ) : rows.length === 0 ? (
          <div className="flex h-full items-center justify-center p-5 sm:p-6">
            <div className="flex w-full max-w-md flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-page/60 px-5 py-8 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-tint text-accent">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  className="h-6 w-6"
                  aria-hidden="true"
                >
                  <path d="M4 6v12 M7 6v12 M10 6v12 M14 6v12 M17 6v12 M20 6v12" />
                </svg>
              </span>
              <h3 className="mt-4 font-serif text-xl font-bold text-ink">
                No numbers yet
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Add the accession numbers above — they will wait here until a
                template is created.
              </p>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 sm:px-6"
              >
                <div className="min-w-0">
                  <p
                    className="truncate text-sm font-semibold text-ink"
                    title={entry.accession_number}
                  >
                    {entry.accession_number}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    Added {displayTime(entry.added_at)} by {entry.added_by}
                  </p>
                </div>
                <button
                  type="button"
                  className={tableButton}
                  disabled={removingId === entry.id}
                  onClick={() => remove(entry)}
                >
                  {removingId === entry.id ? "Removing…" : "Remove"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <nav
        aria-label="Queue pagination"
        className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 text-[11px] text-slate-500 sm:px-6"
      >
        <span>
          {rows === null
            ? "Loading…"
            : `Page ${page} · ${total.toLocaleString()} number${total === 1 ? "" : "s"} in the queue`}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={tableButton}
            disabled={rows === null || page === 1}
            onClick={() => goToPage(page - 1)}
          >
            Previous
          </button>
          <span
            aria-current="page"
            className="grid h-9 min-w-9 place-items-center rounded-xl bg-navy px-3 text-xs font-semibold text-white"
          >
            {page}
          </span>
          <button
            type="button"
            className={tableButton}
            disabled={rows === null || !hasNext}
            onClick={() => goToPage(page + 1)}
          >
            Next
          </button>
        </div>
      </nav>
    </WorkspacePanel>
  );
}
