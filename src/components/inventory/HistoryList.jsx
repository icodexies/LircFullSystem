// Finished inventories. Each row keeps its saved summary; View records opens
// the saved scans and missing confirmations one page at a time.
import { useEffect, useState } from "react";
import {
  getInventoryEntries,
  getInventoryHistory,
} from "../../services/inventory/inventoryService.js";
import {
  conditionLabel,
  conditionTone,
} from "../../services/inventory/inventoryRules.js";
import { displayTime } from "../../services/attendance/attendanceRules.js";
import { tableButton } from "../attendance/StaffUi.jsx";
import {
  WorkspacePanel,
  StatusBadge,
  secondaryButton,
} from "../attendance/WorkspaceUi.jsx";
import { LoadingBlock } from "../ui/Loading.jsx";
import Modal from "../ui/Modal.jsx";

function SummaryChips({ summary }) {
  if (!summary) return null;
  const items = [
    `Found ${summary.found}`,
    `Good ${summary.found_good}`,
    `Damaged ${summary.found_damaged}`,
    `Lost ${summary.found_lost}`,
    `Missing ${summary.missing}`,
    `Not yet checked ${summary.not_checked}`,
    `On loan ${summary.borrowed}`,
  ];
  return <p className="mt-1 text-xs text-slate-500">{items.join(" · ")}</p>;
}

function HistoryDetail({ session, onClose }) {
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getInventoryEntries(session.id, { page, pageSize: 50 })
      .then((data) => {
        if (!active) return;
        setRows(data?.rows ?? []);
        setTotal(data?.total ?? 0);
        setHasNext(Boolean(data?.has_next));
        setError("");
      })
      .catch((err) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [session.id, page]);

  function goToPage(next) {
    setRows(null);
    setError("");
    setPage(next);
  }

  return (
    <Modal
      title={`${session.name} · ${session.year}`}
      description={`Finished ${displayTime(session.finished_at)} by ${session.finished_by || "—"}. ${total.toLocaleString()} saved record${total === 1 ? "" : "s"}.`}
      icon={
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path d="M4 8h16v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z M3 4h18v4H3z M10 12h4" />
        </svg>
      }
      size="lg"
      onClose={onClose}
      footer={
        <nav
          aria-label="Saved records pagination"
          className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-600"
        >
          <span>
            Page {page} · {total.toLocaleString()} saved record
            {total === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className={tableButton}
              disabled={page === 1 || rows === null}
              onClick={() => goToPage(page - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className={tableButton}
              disabled={!hasNext}
              onClick={() => goToPage(page + 1)}
            >
              Next
            </button>
          </div>
        </nav>
      }
    >
      <div className="space-y-4 p-5 sm:p-6">
        <SummaryChips summary={session.summary} />
        {error ? (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-3 text-xs text-red-700"
          >
            {error}
          </p>
        ) : rows === null ? (
          <LoadingBlock label="Loading records…" className="min-h-[10rem]" />
        ) : rows.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-500">
            No records were saved in this inventory.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    {entry.accession_number}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {entry.book_name}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    tone={conditionTone(
                      entry.outcome === "Missing" ? "Missing" : entry.condition,
                    )}
                  >
                    {entry.outcome === "Missing"
                      ? "Missing"
                      : conditionLabel(entry.condition)}
                  </StatusBadge>
                  <span className="text-[11px] text-slate-500">
                    {entry.recorded_by} · {displayTime(entry.recorded_at)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

export default function HistoryList({ revision }) {
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState("");
  const [localRevision, setLocalRevision] = useState(0);
  const [viewing, setViewing] = useState(null);

  useEffect(() => {
    let active = true;
    getInventoryHistory()
      .then((rows) => {
        if (!active) return;
        setSessions(rows);
        setError("");
      })
      .catch((err) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [revision, localRevision]);

  function reload() {
    setSessions(null);
    setError("");
    setLocalRevision((value) => value + 1);
  }

  return (
    <WorkspacePanel
      title="Inventory history"
      description="Finished inventories stay here. Every copy keeps its latest confirmed condition."
      actions={
        <button
          type="button"
          className={secondaryButton}
          onClick={reload}
        >
          Refresh
        </button>
      }
    >
      <div className="px-5 py-4 sm:px-6">
        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-red-100 bg-red-50 p-4 text-xs text-red-700"
          >
            {error}
          </p>
        ) : sessions === null ? (
          <LoadingBlock label="Loading history…" className="min-h-[8rem]" />
        ) : sessions.length === 0 ? (
          <p className="text-xs text-slate-500">
            No inventory has been finished yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    {session.name} · {session.year}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Finished {displayTime(session.finished_at)} by{" "}
                    {session.finished_by || "—"}
                  </p>
                  <SummaryChips summary={session.summary} />
                </div>
                <button
                  type="button"
                  className={tableButton}
                  onClick={() => setViewing(session)}
                >
                  View records
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {viewing && (
        <HistoryDetail session={viewing} onClose={() => setViewing(null)} />
      )}
    </WorkspacePanel>
  );
}
