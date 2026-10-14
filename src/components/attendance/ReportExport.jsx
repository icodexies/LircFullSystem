// Attendance exports as an Excel report — the job runs outside this page
// (see attendanceExportJob.js), so browsing elsewhere does not cancel it and
// the file downloads by itself when it is ready. The enrollment page keeps
// the plain CSV download, which follows the page as before.
import { useEffect, useRef, useState } from "react";
import { getReport } from "../../services/attendance/attendanceService.js";
import { csvCell } from "../../services/attendance/attendanceRules.js";
import { useAttendanceExport } from "../../hooks/attendance/useAttendanceExport.js";
import { downloadBlob } from "../../services/shared/fileDownload.js";
import { buttonClass } from "./StaffUi.jsx";
import { useToast } from "../../hooks/shared/useToast.js";

const ENROLLMENT_COLUMNS = [
  "full_name",
  "library_id",
  "status",
  "year_level",
  "estimated_level",
  "needs_review",
  "department",
  "program",
  "validated_at",
  "validator",
  "auth_linked",
];

export default function ReportExport({
  kind,
  periodId,
  periodName,
  filters,
  disabled,
}) {
  const toast = useToast();
  const { running, lastResult, start, cancel, acknowledge } =
    useAttendanceExport();
  const [csvBusy, setCsvBusy] = useState(false);
  const controller = useRef(null);
  const ackedRef = useRef(null);
  useEffect(() => () => controller.current?.abort(), [kind, periodId, filters]);

  // Report a finished job once — also when the page was left meanwhile.
  useEffect(() => {
    if (!lastResult || ackedRef.current === lastResult) return;
    ackedRef.current = lastResult;
    if (lastResult.type === "done") {
      toast.success(
        `${lastResult.total.toLocaleString()} visits exported with the report.`,
      );
    } else {
      toast.error(lastResult.message, "Export failed");
    }
    acknowledge();
  }, [lastResult, toast, acknowledge]);

  async function exportEnrollmentCsv() {
    if (csvBusy || !periodId) return;
    const abort = new AbortController();
    controller.current = abort;
    setCsvBusy(true);
    try {
      const lines = [ENROLLMENT_COLUMNS.map(csvCell).join(",")];
      for (let page = 1; ; page++) {
        const data = await getReport(
          kind,
          periodId,
          filters,
          page,
          abort.signal,
          100,
        );
        if (abort.signal.aborted) return;
        lines.push(
          ...data.rows.map((row) =>
            ENROLLMENT_COLUMNS.map((key) => csvCell(row[key])).join(","),
          ),
        );
        if (!data.has_next) break;
      }
      downloadBlob(
        new Blob(["\uFEFF", lines.join("\r\n")], {
          type: "text/csv;charset=utf-8",
        }),
        `${kind}-${periodId}.csv`,
      );
    } catch (error) {
      if (!abort.signal.aborted) toast.error(error.message, "Export failed");
    } finally {
      setCsvBusy(false);
    }
  }

  function onClick() {
    if (kind === "attendance") {
      start({ periodId, periodName, filters });
      return;
    }
    void exportEnrollmentCsv();
  }

  const busy = kind === "attendance" ? running : csvBusy;
  const label =
    kind === "attendance"
      ? running
        ? "Preparing report…"
        : "Export report (Excel)"
      : csvBusy
        ? "Exporting…"
        : "Export filtered CSV";

  return (
    <div>
      <button
        type="button"
        className={buttonClass}
        disabled={disabled || busy || !periodId}
        onClick={onClick}
      >
        {label}
      </button>
      {busy && (
        <button
          type="button"
          className="ml-3 text-xs underline"
          onClick={() =>
            kind === "attendance" ? cancel() : controller.current?.abort()
          }
        >
          Cancel export
        </button>
      )}
      {kind === "attendance" && running && (
        <p className="mt-1 text-[11px] text-slate-500">
          You can keep browsing — the file downloads by itself when it is
          ready.
        </p>
      )}
    </div>
  );
}
