// Builds the Acquisition List Excel report, styled like the borrow and
// attendance workbooks. Three sheets:
//   Report       — title block, generated line, and the summary (by status,
//                  by source, and by department)
//   By department — every suggestion grouped department first, then program
//                  (a subject shared by several programs appears under each)
//   Acquisitions — every suggestion in a clean flat table with its
//                  department and program columns
import { displayTime } from "../attendance/attendanceRules.js";

export const ACQUISITION_COLUMNS = [
  "Title",
  "Author",
  "Subject",
  "Department",
  "Program",
  "Source",
  "Status",
  "Suggested by",
  "Sent",
  "Reviewed",
  "Reviewed by",
  "Note",
  "Review note",
];
export const ACQUISITION_WIDTHS = [
  40, 26, 12, 30, 16, 12, 20, 24, 22, 22, 24, 36, 36,
];

export const GROUP_COLUMNS = [
  "Title",
  "Subject",
  "Source",
  "Status",
  "Suggested by",
  "Sent",
];
export const GROUP_WIDTHS = [44, 12, 12, 20, 26, 22];

const SOURCE_LABELS = {
  ai: "AI pick",
  faculty: "Faculty",
  librarian: "Library",
};

const STATUS_LABELS = {
  pending: "Waiting for review",
  approved: "Approved",
  rejected: "Not added",
};

const UNPLACED_DEPARTMENT = "Not in the curriculum";
const UNPLACED_PROGRAM = "No program recorded";

const NAVY = "FF0B1330";
const JADE = "FF0F8A6B";
const HEAD_FILL = "FFF0EDFA";
const ZEBRA = "FFF7F6FB";
const MUTED = "FF5B6B8C";
const BORDER_COLOR = "FFD9D5E8";

const thin = { style: "thin", color: { argb: BORDER_COLOR } };
const border = { top: thin, left: thin, bottom: thin, right: thin };

const A4_PAPER_SIZE = 9;
const MARGINS = {
  left: 0.7,
  right: 0.7,
  top: 0.75,
  bottom: 0.75,
  header: 0.3,
  footer: 0.3,
};

function band(sheet, rowNumber, text, columns) {
  sheet.mergeCells(rowNumber, 1, rowNumber, columns);
  const cell = sheet.getCell(rowNumber, 1);
  cell.value = text;
  cell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  cell.alignment = { vertical: "middle" };
  sheet.getRow(rowNumber).height = 22;
}

function subBand(sheet, rowNumber, text, columns) {
  sheet.mergeCells(rowNumber, 1, rowNumber, columns);
  const cell = sheet.getCell(rowNumber, 1);
  cell.value = text;
  cell.font = { bold: true, size: 10, color: { argb: NAVY } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD_FILL } };
  cell.alignment = { vertical: "middle", indent: 1 };
  sheet.getRow(rowNumber).height = 18;
}

function tableHeader(sheet, rowNumber, labels) {
  labels.forEach((label, index) => {
    const cell = sheet.getCell(rowNumber, index + 1);
    cell.value = label;
    cell.font = { bold: true, size: 10, color: { argb: NAVY } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEAD_FILL } };
    cell.border = border;
    cell.alignment = { vertical: "middle" };
  });
}

function dataRow(
  sheet,
  rowNumber,
  values,
  { bold = false, zebra = false, muted = false } = {},
) {
  values.forEach((value, index) => {
    const cell = sheet.getCell(rowNumber, index + 1);
    cell.value = value;
    cell.font = { bold, size: 10, color: { argb: muted ? MUTED : NAVY } };
    cell.border = border;
    if (zebra) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
    }
    if (typeof value === "number") cell.alignment = { horizontal: "center" };
  });
}

function shareCell(sheet, rowNumber, value, zebra = false) {
  const cell = sheet.getCell(rowNumber, 3);
  cell.value = value;
  cell.numFmt = "0.0%";
  cell.border = border;
  cell.alignment = { horizontal: "center" };
  if (zebra) {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
  }
}

function distinctJoin(values) {
  return [...new Set(values.filter(Boolean))].join(", ");
}

// The department / program a suggestion belongs to (a shared subject can
// belong to several programs — all of them are listed).
function placementsOf(row) {
  const list = row.placements ?? [];
  if (!list.length)
    return [{ department: UNPLACED_DEPARTMENT, program: UNPLACED_PROGRAM }];
  return list;
}

// The summary the workbook needs, computed from the exported rows.
export function summarizeAcquisitions(rows) {
  const list = rows ?? [];
  const byStatus = { pending: 0, approved: 0, rejected: 0 };
  const bySource = { ai: 0, faculty: 0, librarian: 0 };
  const departmentMap = new Map();
  for (const row of list) {
    if (byStatus[row.status] != null) byStatus[row.status] += 1;
    if (bySource[row.source] != null) bySource[row.source] += 1;
    for (const placement of placementsOf(row)) {
      departmentMap.set(
        placement.department,
        (departmentMap.get(placement.department) ?? 0) + 1,
      );
    }
  }
  const byDepartment = [...departmentMap.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return { total: list.length, byStatus, bySource, byDepartment };
}

// department -> program -> rows, sorted for the grouped sheet.
function buildDepartmentTree(rows) {
  const tree = new Map();
  for (const row of rows) {
    for (const placement of placementsOf(row)) {
      if (!tree.has(placement.department)) tree.set(placement.department, new Map());
      const programs = tree.get(placement.department);
      if (!programs.has(placement.program)) programs.set(placement.program, []);
      programs.get(placement.program).push(row);
    }
  }
  return [...tree.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

export async function buildAcquisitionWorkbook({ rows, context }) {
  const { default: ExcelJS } = await import("exceljs");
  const summary = summarizeAcquisitions(rows);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "LIRC Library System";
  workbook.created = new Date();

  /* ------------------------------ Report sheet ---------------------------- */
  const report = workbook.addWorksheet("Report", {
    pageSetup: {
      paperSize: A4_PAPER_SIZE,
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: MARGINS,
    },
  });
  report.getColumn(1).width = 46;
  report.getColumn(2).width = 12;
  report.getColumn(3).width = 12;

  let r = 1;
  report.mergeCells(r, 1, r, 3);
  let cell = report.getCell(r, 1);
  cell.value = "Library Acquisition List";
  cell.font = { bold: true, size: 16, color: { argb: NAVY } };
  r++;
  report.mergeCells(r, 1, r, 3);
  cell = report.getCell(r, 1);
  cell.value = "Books the library plans to acquire";
  cell.font = { bold: true, size: 12, color: { argb: JADE } };
  r++;
  report.mergeCells(r, 1, r, 3);
  cell = report.getCell(r, 1);
  cell.value = `Generated ${displayTime(context.generatedAt)} · ${summary.total.toLocaleString()} suggestions · ${summary.byStatus.pending.toLocaleString()} waiting for review`;
  cell.font = { size: 10, color: { argb: MUTED } };
  r += 2;

  const share = (count) => (summary.total > 0 ? count / summary.total : 0);
  const section = (title, headers, entries, withShare = true) => {
    band(report, r++, title, 3);
    tableHeader(report, r++, headers);
    entries.forEach((entry, index) => {
      const zebra = index % 2 === 1;
      dataRow(report, r, [entry.label, entry.count], { zebra, bold: entry.bold });
      if (withShare) shareCell(report, r, share(entry.count), zebra);
      r++;
    });
    r++;
  };

  section("Summary", ["Measure", "Count", "Share"], [
    { label: "Total suggestions", count: summary.total, bold: true },
    { label: "Waiting for review", count: summary.byStatus.pending },
    { label: "Approved", count: summary.byStatus.approved },
    { label: "Not added", count: summary.byStatus.rejected },
  ]);
  section("By source", ["Source", "Count", "Share"], [
    { label: "AI pick", count: summary.bySource.ai },
    { label: "Faculty", count: summary.bySource.faculty },
    { label: "Library", count: summary.bySource.librarian },
  ]);
  section(
    "By department",
    ["Department", "Books"],
    summary.byDepartment,
    false,
  );

  /* --------------------------- By department sheet ------------------------ */
  const grouped = workbook.addWorksheet("By department", {
    pageSetup: {
      paperSize: A4_PAPER_SIZE,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: MARGINS,
    },
  });
  GROUP_WIDTHS.forEach((width, index) => {
    grouped.getColumn(index + 1).width = width;
  });

  grouped.mergeCells(1, 1, 1, GROUP_COLUMNS.length);
  cell = grouped.getCell(1, 1);
  cell.value = "Acquisitions by department and program";
  cell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  cell.alignment = { vertical: "middle" };
  grouped.getRow(1).height = 24;

  grouped.mergeCells(2, 1, 2, GROUP_COLUMNS.length);
  cell = grouped.getCell(2, 1);
  cell.value = `Generated ${displayTime(context.generatedAt)} — books grouped by department, then by program`;
  cell.font = { size: 9, color: { argb: MUTED } };

  let g = 4;
  for (const [department, programs] of buildDepartmentTree(rows)) {
    const departmentCount = [...programs.values()].reduce(
      (total, list) => total + list.length,
      0,
    );
    band(
      grouped,
      g++,
      `${department} — ${departmentCount} ${departmentCount === 1 ? "book" : "books"}`,
      GROUP_COLUMNS.length,
    );
    for (const [program, list] of [...programs.entries()].sort((a, b) =>
      a[0].localeCompare(b[0]),
    )) {
      subBand(
        grouped,
        g++,
        `${program} — ${list.length} ${list.length === 1 ? "book" : "books"}`,
        GROUP_COLUMNS.length,
      );
      tableHeader(grouped, g++, GROUP_COLUMNS);
      list.forEach((row, index) => {
        dataRow(
          grouped,
          g++,
          [
            row.title,
            row.course_code ?? "",
            SOURCE_LABELS[row.source] ?? row.source,
            STATUS_LABELS[row.status] ?? row.status,
            row.suggested_by_name ?? "",
            displayTime(row.created_at),
          ],
          { zebra: index % 2 === 1 },
        );
      });
      g++;
    }
  }

  /* --------------------------- Acquisitions sheet ------------------------- */
  const sheet = workbook.addWorksheet("Acquisitions", {
    pageSetup: {
      paperSize: A4_PAPER_SIZE,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: "4:4",
      margins: MARGINS,
    },
    views: [{ state: "frozen", ySplit: 4 }],
  });
  ACQUISITION_WIDTHS.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });

  sheet.mergeCells(1, 1, 1, ACQUISITION_COLUMNS.length);
  cell = sheet.getCell(1, 1);
  cell.value = "Acquisitions — books to acquire";
  cell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  cell.alignment = { vertical: "middle" };
  sheet.getRow(1).height = 24;

  sheet.mergeCells(2, 1, 2, ACQUISITION_COLUMNS.length);
  cell = sheet.getCell(2, 1);
  cell.value = `Generated ${displayTime(context.generatedAt)} — every suggestion, newest first`;
  cell.font = { size: 9, color: { argb: MUTED } };

  tableHeader(sheet, 4, ACQUISITION_COLUMNS);
  rows.forEach((row, index) => {
    const placements = placementsOf(row);
    dataRow(
      sheet,
      5 + index,
      [
        row.title,
        row.author ?? "",
        row.course_code ?? "",
        distinctJoin(placements.map((placement) => placement.department)),
        distinctJoin(placements.map((placement) => placement.program)),
        SOURCE_LABELS[row.source] ?? row.source,
        STATUS_LABELS[row.status] ?? row.status,
        row.suggested_by_name ?? "",
        displayTime(row.created_at),
        row.reviewed_at ? displayTime(row.reviewed_at) : "",
        row.reviewed_by_name ?? "",
        row.note ?? "",
        row.review_note ?? "",
      ],
      { zebra: index % 2 === 1 },
    );
  });

  return workbook;
}
