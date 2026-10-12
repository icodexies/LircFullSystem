import { useEffect, useRef, useState } from "react";
import { getReport } from "../../services/attendance/attendanceService.js";
import { csvCell } from "../../services/attendance/attendanceRules.js";
import { buttonClass } from "./StaffUi.jsx";
import { useToast } from "../../hooks/shared/useToast.js";
export default function ReportExport({ kind, periodId, filters, disabled }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), [kind, periodId, filters]);
  async function exportRows() {
    if (busy || !periodId) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    const columns =
      kind === "enrollment"
        ? [
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
          ]
        : [
            "full_name",
            "library_id",
            "semester",
            "role",
            "year_level",
            "year_level_note",
            "department",
            "program",
            "position",
            "purpose",
            "time_in",
            "time_out",
            "duration",
            "current_enrollment_status",
            "recorded_by",
            "checked_out_by",
          ];
    try {
      const lines = [columns.map(csvCell).join(",")];
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
            columns.map((key) => csvCell(row[key])).join(","),
          ),
        );
        if (!data.has_next) break;
      }
      if (abort.signal.aborted) return;
      const url = URL.createObjectURL(
        new Blob(["\uFEFF", lines.join("\r\n")], {
          type: "text/csv;charset=utf-8",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `${kind}-${periodId}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      if (!abort.signal.aborted) toast.error(error.message, "Export failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button
        type="button"
        className={buttonClass}
        disabled={disabled || busy || !periodId}
        onClick={exportRows}
      >
        {busy ? "Exporting…" : "Export filtered CSV"}
      </button>
      {busy && (
        <button
          type="button"
          className="ml-3 text-xs underline"
          onClick={() => controller.current?.abort()}
        >
          Cancel export
        </button>
      )}
    </div>
  );
}
