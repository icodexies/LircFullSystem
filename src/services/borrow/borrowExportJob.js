// The Book Borrow Excel report job. It lives outside the page component, so
// navigating to another page does not cancel it — the file downloads by
// itself when it is ready. One job at a time; pages subscribe for the button
// state (see useBorrowExport).
import { getBorrowReportExport } from "./borrowReportService.js";
import { manilaDate } from "../attendance/attendanceRules.js";
import { summarizeBorrow } from "./borrowReportRules.js";
import { buildBorrowReportWorkbook } from "./borrowReportWorkbook.js";
import { downloadBlob } from "../shared/fileDownload.js";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

let activeJob = null;
let state = { running: false, lastResult: null };
const listeners = new Set();

function setState(next) {
  state = next;
  for (const listener of listeners) listener();
}

export function subscribeBorrowExport(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function borrowExportState() {
  return state;
}

export function startBorrowExport({ filters, description }) {
  if (activeJob) return false;
  const job = { cancelled: false, controller: new AbortController() };
  activeJob = job;
  setState({ running: true, lastResult: null });
  void run(job, { filters, description });
  return true;
}

async function run(job, { filters, description }) {
  try {
    const rows = await getBorrowReportExport(filters, job.controller.signal);
    if (job.cancelled) return finish(job, null);
    const summary = summarizeBorrow(rows);
    const workbook = await buildBorrowReportWorkbook({
      rows,
      summary,
      context: {
        filters: description ?? [],
        generatedAt: new Date(),
      },
    });
    const buffer = await workbook.xlsx.writeBuffer();
    if (job.cancelled) return finish(job, null);
    downloadBlob(
      new Blob([buffer], { type: XLSX_MIME }),
      `borrow-report-${manilaDate()}.xlsx`,
    );
    finish(job, { type: "done", total: rows.length, at: Date.now() });
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

export function cancelBorrowExport() {
  if (!activeJob) return;
  activeJob.cancelled = true;
  activeJob.controller.abort();
}

export function acknowledgeBorrowExportResult() {
  if (!state.lastResult) return;
  setState({ running: state.running, lastResult: null });
}
