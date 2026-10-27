// Builds the attendance Excel report. Kept separate from the download so the
// layout can be tested. Four sheets:
//   Report — title block, the applied filters, and the summary sections:
//            visitor type, purpose, department → program, students by year
//            level (department → year · program), faculty/staff by position
//   Attendance by Program — one row per day, one column per program, using
//            each filtered visit's arrival date
//   Unique visitors — one line per person with their entry count, organized
//            students by department → program, faculty and non-teaching
//            personnel by position, library personnel by role, guests by card
//   Visits — the filtered rows in a clean table
import { ROLE_LABELS } from "../../routes/roles.js";
import { displayTime } from "./attendanceRules.js";
import {
  dailyProgramAttendance,
  yearLabel,
} from "./attendanceReportRules.js";

export const VISIT_COLUMNS = [
  "Visitor",
  "Card",
  "Visitor type",
  "Year level",
  "Purpose",
  "Time in",
  "Time out",
];
export const VISIT_WIDTHS = [30, 14, 14, 12, 26, 24, 24];

export const VISITOR_COLUMNS = [
  "Name / group",
  "Card",
  "Visitor type",
  "Year level",
  "Department",
  "Position",
  "Visits",
];
export const VISITOR_WIDTHS = [32, 14, 15, 12, 16, 24, 8];

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

function attendanceDayLabel(day) {
  const date = new Date(`${day}T12:00:00+08:00`);
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function dataRow(sheet, rowNumber, values, { bold = false, indent = 0, zebra = false, muted = false } = {}) {
  values.forEach((value, index) => {
    const cell = sheet.getCell(rowNumber, index + 1);
    cell.value = value;
    cell.font = {
      bold,
      size: 10,
      color: { argb: muted ? MUTED : NAVY },
    };
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

export async function buildAttendanceReportWorkbook({ rows, summary, context }) {
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
  report.getColumn(1).width = 42;
  report.getColumn(2).width = 12;
  report.getColumn(3).width = 12;

  let r = 1;
  report.mergeCells(r, 1, r, 3);
  let cell = report.getCell(r, 1);
  cell.value = "Library Attendance Report";
  cell.font = { bold: true, size: 16, color: { argb: NAVY } };
  r++;
  report.mergeCells(r, 1, r, 3);
  cell = report.getCell(r, 1);
  cell.value = context.semesterName ?? "Attendance";
  cell.font = { bold: true, size: 12, color: { argb: JADE } };
  r++;
  report.mergeCells(r, 1, r, 3);
  cell = report.getCell(r, 1);
  cell.value = `Generated ${displayTime(context.generatedAt)} · ${summary.total.toLocaleString()} visits · ${summary.uniqueVisitors.toLocaleString()} unique visitors`;
  cell.font = { size: 10, color: { argb: MUTED } };
  r += 2;

  band(report, r++, "Applied filters", 3);
  if (!context.filters || context.filters.length === 0) {
    report.mergeCells(r, 1, r, 3);
    cell = report.getCell(r, 1);
    cell.value = "None — every visit in this semester.";
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

  const share = (count) => (summary.total > 0 ? count / summary.total : 0);
  const section = (title, headers, entries) => {
    band(report, r++, title, 3);
    tableHeader(report, r++, headers);
    entries.forEach((entry, index) => {
      const zebra = index % 2 === 1;
      dataRow(report, r, [entry.label, entry.count], { zebra });
      shareCell(report, r, share(entry.count), zebra);
      r++;
    });
    r++;
  };

  section("Visits by visitor type", ["Visitor type", "Visits", "Share"], summary.byRole);
  section("Visits by purpose", ["Purpose", "Visits", "Share"], summary.byPurpose);

  // All departments read as one tree: department → program → year levels
  // (plus one "Faculty & staff" line for non-student visits in that program).
  band(report, r++, "Visits by department, program and year level", 3);
  tableHeader(report, r++, [
    "Department / program / year level",
    "Visits",
    "Share",
  ]);
  summary.departments.forEach((dept) => {
    dataRow(report, r, [dept.department, dept.count], { bold: true });
    shareCell(report, r, share(dept.count));
    r++;
    dept.programs.forEach((prog) => {
      dataRow(report, r, [prog.label, prog.count], { indent: 1 });
      shareCell(report, r, dept.count > 0 ? prog.count / dept.count : 0);
      r++;
      prog.years.forEach((year) => {
        dataRow(report, r, [year.label, year.count], { indent: 2, muted: true });
        r++;
      });
      if (prog.staff > 0) {
        dataRow(report, r, ["Faculty & staff", prog.staff], {
          indent: 2,
          muted: true,
        });
        r++;
      }
    });
  });
  r++;

  if (summary.byPosition.length > 0) {
    section(
      "Faculty & staff by position",
      ["Position", "Visits", "Share"],
      summary.byPosition,
    );
  }

  /* ---------------------- Attendance by Program sheet --------------------- */
  const daily = dailyProgramAttendance(rows, context.rawFilters);
  const dailyHeaders = ["Day", "Date", ...daily.programs, "Total"];
  const dailySheet = workbook.addWorksheet("Attendance by Program", {
    pageSetup: {
      paperSize: A4_PAPER_SIZE,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: MARGINS,
    },
    views: [{ state: "frozen", ySplit: 6 }],
  });

  dailySheet.getColumn(1).width = 10;
  dailySheet.getColumn(2).width = 20;
  daily.programs.forEach((_, index) => {
    dailySheet.getColumn(index + 3).width = 12;
  });
  dailySheet.getColumn(3 + daily.programs.length).width = 10;

  band(dailySheet, 1, "Attendance by Program", dailyHeaders.length);
  dailySheet.getCell(1, 1).font = {
    bold: true,
    size: 14,
    color: { argb: "FFFFFFFF" },
  };

  dailySheet.mergeCells(2, 1, 2, dailyHeaders.length);
  cell = dailySheet.getCell(2, 1);
  cell.value = context.semesterName ?? "Attendance";
  cell.font = { bold: true, size: 11, color: { argb: JADE } };

  dailySheet.mergeCells(3, 1, 3, dailyHeaders.length);
  cell = dailySheet.getCell(3, 1);
  cell.value =
    context.filters && context.filters.length > 0
      ? `Filters - ${context.filters.join(" | ")}`
      : "Filters - none (every visit in this semester)";
  cell.font = { size: 9, color: { argb: MUTED } };
  cell.alignment = { wrapText: true, vertical: "top" };
  dailySheet.getRow(3).height = 30;

  dailySheet.mergeCells(4, 1, 4, dailyHeaders.length);
  cell = dailySheet.getCell(4, 1);
  cell.value =
    "Each recorded visit counts once. A visitor with more than one visit on the same day is counted for each visit.";
  cell.font = { size: 9, color: { argb: MUTED } };

  tableHeader(dailySheet, 6, dailyHeaders);
  let d = 7;
  if (daily.days.length === 0) {
    dailySheet.mergeCells(d, 1, d, dailyHeaders.length);
    cell = dailySheet.getCell(d, 1);
    cell.value = "No visits match these filters.";
    cell.font = { italic: true, size: 10, color: { argb: MUTED } };
  } else {
    daily.days.forEach((entry, index) => {
      dataRow(
        dailySheet,
        d,
        [
          `Day ${entry.day}`,
          attendanceDayLabel(entry.date),
          ...entry.counts,
          entry.total,
        ],
        { zebra: index % 2 === 1 },
      );
      d++;
    });

    const totals = daily.programs.map((_, programIndex) =>
      daily.days.reduce(
        (sum, entry) => sum + entry.counts[programIndex],
        0,
      ),
    );
    dataRow(
      dailySheet,
      d,
      [
        "Total",
        "",
        ...totals,
        totals.reduce((sum, count) => sum + count, 0),
      ],
      { bold: true },
    );
  }

  /* -------------------------- Unique visitors sheet ----------------------- */
  const visitors = workbook.addWorksheet("Unique visitors", {
    pageSetup: {
      paperSize: A4_PAPER_SIZE,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: MARGINS,
    },
  });
  VISITOR_WIDTHS.forEach((width, index) => {
    visitors.getColumn(index + 1).width = width;
  });

  visitors.mergeCells(1, 1, 1, VISITOR_COLUMNS.length);
  cell = visitors.getCell(1, 1);
  cell.value = `Unique visitors — ${context.semesterName ?? "Attendance"}`;
  cell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  cell.alignment = { vertical: "middle" };
  visitors.getRow(1).height = 24;

  visitors.mergeCells(2, 1, 2, VISITOR_COLUMNS.length);
  cell = visitors.getCell(2, 1);
  cell.value =
    context.filters && context.filters.length > 0
      ? `Filters — ${context.filters.join(" · ")}`
      : "Filters — none (every visit in this semester)";
  cell.font = { size: 9, color: { argb: MUTED } };

  visitors.mergeCells(3, 1, 3, VISITOR_COLUMNS.length);
  cell = visitors.getCell(3, 1);
  cell.value = `${summary.visitors.total.toLocaleString()} unique visitors · ${summary.total.toLocaleString()} visits — each person once, with how many times they came`;
  cell.font = { size: 9, color: { argb: MUTED } };

  let v = 5;
  const visitorHeader = () => tableHeader(visitors, v++, VISITOR_COLUMNS);

  band(visitors, v++, "Students — by department and program", VISITOR_COLUMNS.length);
  visitorHeader();
  summary.visitors.students.forEach((dept) => {
    dataRow(visitors, v, [dept.department, "", "", "", "", "", dept.visits], {
      bold: true,
    });
    v++;
    dept.programs.forEach((program) => {
      dataRow(visitors, v, [program.program, "", "", "", "", "", program.visits], {
        indent: 1,
      });
      v++;
      program.persons.forEach((person) => {
        dataRow(
          visitors,
          v,
          [
            person.name,
            person.library_id,
            ROLE_LABELS[person.role] ?? person.role,
            yearLabel(person.year_level),
            "",
            "",
            person.visits,
          ],
          { indent: 2 },
        );
        v++;
      });
    });
  });
  v++;

  summary.visitors.sections.forEach((group) => {
    band(visitors, v++, group.title, VISITOR_COLUMNS.length);
    visitorHeader();
    group.groups.forEach((entry) => {
      if (entry.label) {
        dataRow(visitors, v, [entry.label, "", "", "", "", "", entry.visits], {
          bold: true,
        });
        v++;
      }
      entry.persons.forEach((person) => {
        dataRow(
          visitors,
          v,
          [
            person.name,
            person.library_id,
            ROLE_LABELS[person.role] ?? person.role,
            "",
            person.department,
            person.position,
            person.visits,
          ],
          { indent: entry.label ? 1 : 0 },
        );
        v++;
      });
    });
    v++;
  });

  /* ------------------------------ Visits sheet ---------------------------- */
  const visits = workbook.addWorksheet("Visits", {
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
  VISIT_WIDTHS.forEach((width, index) => {
    visits.getColumn(index + 1).width = width;
  });

  visits.mergeCells(1, 1, 1, VISIT_COLUMNS.length);
  cell = visits.getCell(1, 1);
  cell.value = `Visits — ${context.semesterName ?? "Attendance"}`;
  cell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  cell.alignment = { vertical: "middle" };
  visits.getRow(1).height = 24;

  visits.mergeCells(2, 1, 2, VISIT_COLUMNS.length);
  cell = visits.getCell(2, 1);
  cell.value =
    context.filters && context.filters.length > 0
      ? `Filters — ${context.filters.join(" · ")}`
      : "Filters — none (every visit in this semester)";
  cell.font = { size: 9, color: { argb: MUTED } };

  tableHeader(visits, 4, VISIT_COLUMNS);
  rows.forEach((row, index) => {
    dataRow(
      visits,
      5 + index,
      [
        row.guest_name || row.full_name,
        row.library_id,
        ROLE_LABELS[row.role] ?? row.role,
        row.role === "student" ? yearLabel(row.year_level) : "",
        row.purpose,
        displayTime(row.time_in),
        displayTime(row.time_out),
      ],
      { zebra: index % 2 === 1 },
    );
  });

  return workbook;
}
