// The Report tab in Book Borrow: filters + a summary + the detailed loan
// table, and the Excel export (a background job like the attendance report —
// it keeps running while you browse, and the file downloads by itself).
import { useEffect, useMemo, useRef, useState } from "react";
import { useSemester } from "../../hooks/periods/useSemester.js";
import { useBorrowExport } from "../../hooks/borrow/useBorrowExport.js";
import { useBorrowReport } from "../../hooks/borrow/useBorrowReport.js";
import { useToast } from "../../hooks/shared/useToast.js";
import {
  displayTime,
  manilaBoundary,
} from "../../services/attendance/attendanceRules.js";
import { periodLabel } from "../../services/periods/periodRules.js";
import {
  describeBorrowFilters,
  rowStatusLabel,
} from "../../services/borrow/borrowReportRules.js";
import { ROLE_LABELS } from "../../routes/roles.js";
import { buttonClass } from "../attendance/StaffUi.jsx";
import {
  StatusBadge,
  SummaryCards,
  WorkspacePanel,
  secondaryButton,
} from "../attendance/WorkspaceUi.jsx";
import Avatar from "../ui/Avatar.jsx";
import EmptyState from "../personnel/EmptyState.jsx";
import BorrowReportFilters from "./BorrowReportFilters.jsx";

const PAGE_SIZE = 20;
const GRID = "md:grid-cols-[210px_minmax(0,1fr)_140px_140px_150px_170px]";
const DEFAULT_FORM = {
  search_by: "member",
  search: "",
  status: "",
  role: "",
  sort: "borrowed",
  direction: "desc",
  borrowed_from: "",
  borrowed_to: "",
  due_from: "",
  due_to: "",
  returned_from: "",
  returned_to: "",
};

// The form's Philippine days become ISO boundaries for the server.
function buildApiFilters(form) {
  const value = {
    sort: form.sort || "borrowed",
    direction: form.direction || "desc",
  };
  if (form.search?.trim()) {
    value.search = form.search.trim();
    value.search_by = form.search_by || "member";
  }
  if (form.status) value.status = form.status;
  if (form.role) value.role = form.role;
  if (form.borrowed_from) value.borrowed_from = manilaBoundary(form.borrowed_from);
  if (form.borrowed_to) value.borrowed_to = manilaBoundary(form.borrowed_to, true);
  if (form.due_from) value.due_from = manilaBoundary(form.due_from);
  if (form.due_to) value.due_to = manilaBoundary(form.due_to, true);
  if (form.returned_from) value.returned_from = manilaBoundary(form.returned_from);
  if (form.returned_to) value.returned_to = manilaBoundary(form.returned_to, true);
  return value;
}

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

// The Excel export button, subscribed to the background job.
function BorrowExportButton({ filters, form, disabled }) {
  const toast = useToast();
  const { running, lastResult, start, cancel, acknowledge } = useBorrowExport();
  const ackedRef = useRef(null);

  // Report a finished job once — also when the page was left meanwhile.
  useEffect(() => {
    if (!lastResult || ackedRef.current === lastResult) return;
    ackedRef.current = lastResult;
    if (lastResult.type === "done") {
      toast.success(
        `${lastResult.total.toLocaleString()} loans exported with the report.`,
      );
    } else {
      toast.error(lastResult.message, "Export failed");
    }
    acknowledge();
  }, [lastResult, toast, acknowledge]);

  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <button
        type="button"
        className={buttonClass}
        disabled={disabled || running}
        onClick={() =>
          start({ filters, description: describeBorrowFilters(form) })
        }
      >
        {running ? "Preparing report…" : "Export report (Excel)"}
      </button>
      {running && (
        <>
          <button type="button" className="text-xs underline" onClick={cancel}>
            Cancel export
          </button>
          <span className="text-[11px] text-slate-500">
            You can keep browsing — the file downloads by itself when it is
            ready.
          </span>
        </>
      )}
    </span>
  );
}

export default function BorrowReportPanel({ revision = 0 }) {
  const periods = useSemester();
  const semester = periods.selectedSemester;
  const [form, setForm] = useState(DEFAULT_FORM);
  const [page, setPage] = useState(1);
  const filters = useMemo(() => buildApiFilters(form), [form]);
  const report = useBorrowReport({ filters, page, pageSize: PAGE_SIZE, revision });
  const summary = report.summary;
  const pages = Math.max(1, Math.ceil(report.total / PAGE_SIZE));

  function change(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  function clearDates() {
    setForm((current) => ({
      ...current,
      borrowed_from: "",
      borrowed_to: "",
      due_from: "",
      due_to: "",
      returned_from: "",
      returned_to: "",
    }));
    setPage(1);
  }

  function reset() {
    setForm(DEFAULT_FORM);
    setPage(1);
  }

  function thisSemester() {
    if (!semester) return;
    setForm((current) => ({
      ...current,
      borrowed_from: semester.starts_on,
      borrowed_to: semester.ends_on,
    }));
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <SummaryCards
        loading={report.loading && !summary}
        items={[
          {
            label: "Matching loans",
            value: summary?.total,
            help: "Loans that match the filters",
          },
          {
            label: "Still out",
            value: summary?.open,
            help: "Not returned yet",
          },
          {
            label: "Overdue",
            value: summary?.overdue,
            help: "Still out past the due date",
            tone: "warning",
          },
          {
            label: "Returned",
            value: summary?.returned,
            help: summary
              ? `${Number(summary.late).toLocaleString()} late · ${Number(summary.on_time).toLocaleString()} on time`
              : "Returned loans",
          },
        ]}
      />

      <WorkspacePanel
        title="Borrow report"
        description="Every loan with its due and return dates. Filters also apply to the summary and the Excel export."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={secondaryButton}
              onClick={report.reload}
              disabled={report.loading}
            >
              Refresh
            </button>
            <BorrowExportButton
              filters={filters}
              form={form}
              disabled={report.loading && !summary}
            />
          </div>
        }
      >
        <BorrowReportFilters
          form={form}
          onChange={change}
          onReset={reset}
          onClearDates={clearDates}
          onThisSemester={thisSemester}
          canThisSemester={Boolean(semester)}
          semesterLabel={semester ? periodLabel(semester) : null}
        />

        {report.error && (
          <p role="alert" className="px-5 pb-3 pt-3 text-xs text-red-700">
            {report.error}
          </p>
        )}

        <div
          className={`hidden gap-x-4 border-y border-slate-200 bg-page px-5 py-2.5 text-[11px] font-semibold text-slate-600 md:grid ${GRID}`}
        >
          <span>Member</span>
          <span>Book</span>
          <span>Borrowed</span>
          <span>Due</span>
          <span>Returned</span>
          <span>Status</span>
        </div>

        {!report.loading && report.rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No loans match these filters."
              description="Try another range or clear the filters to see every record."
            />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {report.rows.map((row) => (
              <li
                key={row.id}
                className={`grid grid-cols-1 gap-x-4 gap-y-2 px-5 py-3.5 text-xs md:items-center ${GRID}`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar src={row.avatar_url} className="h-9 w-9" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink">
                      {row.member_name}
                    </span>
                    <span className="block truncate text-[11px] text-slate-500">
                      {row.library_id} · {ROLE_LABELS[row.role] ?? row.role}
                    </span>
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block font-medium leading-snug text-ink">
                    {row.book_name}
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    Accession {row.accession_number}
                    {row.call_number ? ` · ${row.call_number}` : ""}
                  </span>
                </span>
                <span className="text-slate-500">
                  {displayTime(row.borrowed_at)}
                  {row.recorded_by_name && (
                    <span className="block text-[11px] text-slate-400">
                      by {row.recorded_by_name}
                    </span>
                  )}
                </span>
                <span className="text-slate-500">{displayTime(row.due_at)}</span>
                <span className="text-slate-500">
                  {row.returned_at ? displayTime(row.returned_at) : "—"}
                  {row.returned_at && row.returned_by_name && (
                    <span className="block text-[11px] text-slate-400">
                      by {row.returned_by_name}
                    </span>
                  )}
                </span>
                <span>{statusBadge(row)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
          <p className="text-xs text-slate-500">
            {report.loading && !summary
              ? "Loading…"
              : `${report.total.toLocaleString("en-US")} record${report.total === 1 ? "" : "s"} · page ${page} of ${pages}`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className={secondaryButton}
              disabled={page === 1 || report.loading}
              onClick={() => setPage((value) => value - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className={secondaryButton}
              disabled={!report.hasNext || report.loading}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </WorkspacePanel>
    </div>
  );
}
