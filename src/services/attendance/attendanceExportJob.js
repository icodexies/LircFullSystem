// The attendance Excel report job. It lives outside the page component, so
// navigating to another page does not cancel it — the file downloads by
// itself when it is ready. One job at a time; pages subscribe for the button
// state (see useAttendanceExport).
import { getAttendanceExport } from "./attendanceService.js";
import { manilaDate } from "./attendanceRules.js";
import {
  describeAttendanceFilters,
  summarizeAttendance,
} from "./attendanceReportRules.js";
import { buildAttendanceReportWorkbook } from "./attendanceReportWorkbook.js";
import {
  downloadBlob,
  slugFileName,
} from "../shared/fileDownload.js";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

let activeJob = null;
let state = { running: false, lastResult: null };
const listeners = new Set();

function setState(next) {
  state = next;
  for (const listener of listeners) listener();
}

export function subscribeAttendanceExport(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function attendanceExportState() {
  return state;
}

export function startAttendanceExport({ periodId, periodName, filters }) {
  if (activeJob) return false;
  const job = { cancelled: false, controller: new AbortController() };
  activeJob = job;
  setState({ running: true, lastResult: null });
  void run(job, { periodId, periodName, filters });
  return true;
}

async function run(job, { periodId, periodName, filters }) {
  try {
    const rows = await getAttendanceExport(
      periodId,
      filters,
      job.controller.signal,
    );
    if (job.cancelled) return finish(job, null);
    const summary = summarizeAttendance(rows);
    const workbook = await buildAttendanceReportWorkbook({
      rows,
      summary,
      context: {
        semesterName: periodName,
        filters: describeAttendanceFilters(filters),
        generatedAt: new Date(),
      },
    });
    const buffer = await workbook.xlsx.writeBuffer();
    if (job.cancelled) return finish(job, null);
    downloadBlob(
      new Blob([buffer], { type: XLSX_MIME }),
      `attendance-report-${slugFileName(periodName)}-${manilaDate()}.xlsx`,
    );
    finish(job, { type: "done", total: summary.total, at: Date.now() });
  } catch (error) {
    if (job.cancelled || error?.name === "AbortError") return finish(job, null);
    finish(job, {
      type: "error",
      message: error?.message || "The report could not be generated.",
      at: Date.now(),
    });
  }
}

// Only the job that is still current may clear the slot (a cancel followed
// by a new export must not be overwritten by the old job finishing).
function finish(job, result) {
  if (activeJob !== job) return;
  activeJob = null;
  setState({ running: false, lastResult: result });
}

export function cancelAttendanceExport() {
  if (!activeJob) return;
  activeJob.cancelled = true;
  activeJob.controller.abort();
}

export function acknowledgeAttendanceExportResult() {
  if (!state.lastResult) return;
  setState({ running: state.running, lastResult: null });
}
