// Builds the Book Borrow Excel report, styled like the attendance workbook.
// Two sheets:
//   Report — title block, the applied filters, the summary, loans by member
//            role, loans by month, and the most borrowed books
//   Loans  — every filtered loan in a clean table
import { ROLE_LABELS } from "../../routes/roles.js";
import { displayTime } from "../attendance/attendanceRules.js";
import { rowStatusLabel } from "./borrowReportRules.js";
import { personStatusLabel } from "../users/personStatus.js";

export const LOAN_COLUMNS = [
  "Member",
  "Card",
  "Role",
  "Person status",
  "Department",
  "Program",
  "Book",
  "Accession",
  "Call number",
  "Borrowed",
  "Due",
  "Returned",
  "Status",
];
export const LOAN_WIDTHS = [30, 12, 14, 16, 26, 30, 40, 12, 16, 22, 22, 22, 22];

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
  { bold = false, indent = 0, zebra = false, muted = false } = {},
) {
  values.forEach((value, index) => {
    const cell = sheet.getCell(rowNumber, index + 1);
    cell.value = value;
    cell.font = { bold, size: 10, color: { argb: muted ? MUTED : NAVY } };
    cell.border = border;
    if (zebra) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
    }
    if (index === 0 && indent) cell.alignment = { indent };
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

export async function buildBorrowReportWorkbook({ rows, summary, context }) {
  const { default: ExcelJS } = await import("exceljs");
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
  cell.value = "Library Borrow Report";
  cell.font = { bold: true, size: 16, color: { argb: NAVY } };
  r++;
  report.mergeCells(r, 1, r, 3);
  cell = report.getCell(r, 1);
  cell.value = "Book borrowing records";
  cell.font = { bold: true, size: 12, color: { argb: JADE } };
  r++;
  report.mergeCells(r, 1, r, 3);
  cell = report.getCell(r, 1);
  cell.value = `Generated ${displayTime(context.generatedAt)} · ${summary.total.toLocaleString()} loans · ${summary.uniqueMembers.toLocaleString()} members`;
  cell.font = { size: 10, color: { argb: MUTED } };
  r += 2;

  band(report, r++, "Applied filters", 3);
  if (!context.filters || context.filters.length === 0) {
    report.mergeCells(r, 1, r, 3);
    cell = report.getCell(r, 1);
    cell.value = "None — every loan record.";
    cell.font = { italic: true, size: 10, color: { argb: MUTED } };
    r++;
  } else {
    for (const line of context.filters) {
      report.mergeCells(r, 1, r, 3);
      cell = report.getCell(r, 1);
      cell.value = line;
      cell.font = { size: 10, color: { argb: MUTED } };
      r++;
    }
  }
  r++;

  band(report, r++, "Summary", 3);
  tableHeader(report, r++, ["Measure", "Count", "Share"]);
  const share = (count) => (summary.total > 0 ? count / summary.total : 0);
  const summaryRows = [
    ["Matching loans", summary.total, true],
    ["Still out", summary.open, false],
    ["Overdue (still out)", summary.overdue, false],
    ["Returned", summary.returned, false],
    ["Returned late", summary.late, false],
    ["Returned on time", summary.onTime, false],
    ["Unique members", summary.uniqueMembers, false],
  ];
  summaryRows.forEach(([label, count], index) => {
    const zebra = index % 2 === 1;
    dataRow(report, r, [label, count], { zebra });
    shareCell(report, r, share(count), zebra);
    r++;
  });
  dataRow(report, r, [
    "Average days kept (returned loans)",
    summary.avgDaysKept == null ? "—" : summary.avgDaysKept,
  ]);
  report.mergeCells(r, 3, r, 3);
  r += 2;

  const section = (title, headers, entries, withShare = true) => {
    band(report, r++, title, 3);
    tableHeader(report, r++, headers);
    entries.forEach((entry, index) => {
      const zebra = index % 2 === 1;
      dataRow(report, r, [entry.label, entry.count], { zebra });
      if (withShare) shareCell(report, r, share(entry.count), zebra);
      r++;
    });
    r++;
  };

  section("Loans by member role", ["Role", "Loans", "Share"], summary.byRole);
  section("Loans by month", ["Month", "Loans", "Share"], summary.byMonth);
  section(
    "Most borrowed books (top 15)",
    ["Book", "Loans", "Share"],
    summary.topBooks,
  );

  /* ------------------------------ Loans sheet ----------------------------- */
  const loans = workbook.addWorksheet("Loans", {
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
  LOAN_WIDTHS.forEach((width, index) => {
    loans.getColumn(index + 1).width = width;
  });

  loans.mergeCells(1, 1, 1, LOAN_COLUMNS.length);
  cell = loans.getCell(1, 1);
  cell.value = "Loans — Book Borrow report";
  cell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  cell.alignment = { vertical: "middle" };
  loans.getRow(1).height = 24;

  loans.mergeCells(2, 1, 2, LOAN_COLUMNS.length);
  cell = loans.getCell(2, 1);
  cell.value =
    context.filters && context.filters.length > 0
      ? `Filters — ${context.filters.join(" · ")}`
      : "Filters — none (every loan record)";
  cell.font = { size: 9, color: { argb: MUTED } };

  tableHeader(loans, 4, LOAN_COLUMNS);
  rows.forEach((row, index) => {
    dataRow(
      loans,
      5 + index,
      [
        row.member_name,
        row.library_id,
        ROLE_LABELS[row.role] ?? row.role,
        personStatusLabel(row.person_status),
        row.department ?? "",
        row.program ?? "",
        row.book_name,
        row.accession_number,
        row.call_number ?? "",
        displayTime(row.borrowed_at),
        displayTime(row.due_at),
        row.returned_at ? displayTime(row.returned_at) : "",
        rowStatusLabel(row),
      ],
      { zebra: index % 2 === 1 },
    );
  });

  return workbook;
}
