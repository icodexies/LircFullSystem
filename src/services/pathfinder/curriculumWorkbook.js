import { displayTime, manilaDate } from "../attendance/attendanceRules.js";
import { downloadBlob, slugFileName } from "../shared/fileDownload.js";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const SEMESTER_LABELS = {
  1: "1st Semester",
  2: "2nd Semester",
  3: "Summer",
};
const ORDINALS = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th", 6: "6th" };
const NAVY = "FF0B1330";
const JADE = "FF0F8A6B";
const HEAD_FILL = "FFF0EDFA";
const ZEBRA = "FFF7F6FB";
const MUTED = "FF5B6B8C";
const BORDER_COLOR = "FFD9D5E8";
const NO_BOOK = "No recommended books";

const REPORT_COLUMNS = [
  "Year",
  "Semester",
  "Code",
  "Subject",
  "Units",
  "Book",
  "Author",
  "Published",
  "Copies",
];
const REPORT_WIDTHS = [12, 14, 13, 40, 8, 46, 28, 12, 8];

const BOOK_COLUMNS = ["Book", "Author", "Published", "Copies"];
const BOOK_WIDTHS = [46, 28, 12, 8];

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
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: HEAD_FILL },
  };
  cell.alignment = { vertical: "middle", indent: 1 };
  sheet.getRow(rowNumber).height = 18;
}

function tableHeader(sheet, rowNumber, labels) {
  labels.forEach((label, index) => {
    const cell = sheet.getCell(rowNumber, index + 1);
    cell.value = label;
    cell.font = { bold: true, size: 10, color: { argb: NAVY } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: HEAD_FILL },
    };
    cell.border = border;
    cell.alignment = { vertical: "middle" };
  });
}

function dataRow(sheet, rowNumber, values, { muted = false, zebra = false } = {}) {
  values.forEach((value, index) => {
    const cell = sheet.getCell(rowNumber, index + 1);
    cell.value = value;
    cell.font = {
      size: 10,
      color: { argb: muted ? MUTED : NAVY },
      italic: muted,
    };
    cell.border = border;
    cell.alignment = { vertical: "top", wrapText: index === 3 || index === 5 };
    if (zebra) {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: ZEBRA },
      };
    }
    if (typeof value === "number") {
      cell.alignment = { horizontal: "center", vertical: "top" };
    }
  });
}

function subjectRows(years = []) {
  const rows = [];
  const subjects = [];
  for (const year of years) {
    for (const semester of year.semesters ?? []) {
      for (const subject of semester.subjects ?? []) {
        const books = subject.books ?? [];
        subjects.push({
          year_level: year.year_level,
          semester: semester.semester,
          subject,
          books,
        });
        if (books.length === 0) {
          rows.push({
            year_level: year.year_level,
            semester: semester.semester,
            subject,
            book: null,
          });
        } else {
          for (const book of books) {
            rows.push({
              year_level: year.year_level,
              semester: semester.semester,
              subject,
              book,
            });
          }
        }
      }
    }
  }
  return { rows, subjects };
}

function genEdRows(groups = []) {
  const rows = [];
  const subjects = [];
  for (const group of groups) {
    const books = group.books ?? [];
    subjects.push({ subject: group, books });
    if (books.length === 0) {
      rows.push({ subject: group, book: null, year_level: "Shared", semester: "—" });
    } else {
      for (const book of books) {
        rows.push({
          year_level: "Shared",
          semester: "—",
          subject: group,
          book,
        });
      }
    }
  }
  return { rows, subjects };
}

function rowValues(row) {
  const { subject, book } = row;
  return [
    row.year_level === "Shared" ? "Shared" : `${ORDINALS[row.year_level] ?? row.year_level} Year`,
    row.semester === "—"
      ? "—"
      : SEMESTER_LABELS[row.semester] ?? `Semester ${row.semester}`,
    subject.course_code,
    subject.course_title,
    subject.units ?? "",
    book?.book_name ?? NO_BOOK,
    book?.author ?? "",
    book?.publish_year ?? "",
    book?.copies ?? "",
  ];
}

function prepareData(data, program, isGenEd) {
  const info = data?.program ?? program ?? {};
  const code = isGenEd ? "GEN-ED" : info.code ?? program?.code ?? "PROGRAM";
  const name = isGenEd
    ? "General Education — shared subjects"
    : info.name ?? program?.name ?? "Program";
  const { rows, subjects } = isGenEd
    ? genEdRows(data?.groups ?? [])
    : subjectRows(data?.years ?? []);
  const subjectsWithBooks = subjects.filter((item) => item.books.length > 0);
  const bookCount = subjects.reduce((sum, item) => sum + item.books.length, 0);
  return { info, code, name, rows, subjects, subjectsWithBooks, bookCount };
}

export async function buildCurriculumWorkbook({ data, program, isGenEd = false, generatedAt = new Date() }) {
  if (!data) throw new Error("Open a program before downloading its report.");
  const prepared = prepareData(data, program, isGenEd);
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "LIRC Library System";
  workbook.created = generatedAt;

  const report = workbook.addWorksheet("Report", {
    pageSetup: {
      paperSize: A4_PAPER_SIZE,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: MARGINS,
    },
  });
  BOOK_WIDTHS.forEach((width, index) => {
    report.getColumn(index + 1).width = width;
  });

  report.mergeCells(1, 1, 1, BOOK_COLUMNS.length);
  let cell = report.getCell(1, 1);
  cell.value = "Path Finder Report";
  cell.font = { bold: true, size: 18, color: { argb: NAVY } };
  report.getRow(1).height = 26;

  report.mergeCells(2, 1, 2, BOOK_COLUMNS.length);
  cell = report.getCell(2, 1);
  cell.value = `${prepared.code} — ${prepared.name}`;
  cell.font = { bold: true, size: 12, color: { argb: JADE } };

  report.mergeCells(3, 1, 3, BOOK_COLUMNS.length);
  cell = report.getCell(3, 1);
  cell.value = [
    prepared.info.department,
    prepared.info.director ? `Director: ${prepared.info.director}` : null,
    prepared.info.total_units ? `${prepared.info.total_units} total units` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  cell.font = { size: 10, color: { argb: MUTED } };

  report.mergeCells(4, 1, 4, BOOK_COLUMNS.length);
  cell = report.getCell(4, 1);
  cell.value = `Generated ${displayTime(generatedAt)}  ·  ${prepared.subjects.length} subjects  ·  ${prepared.subjectsWithBooks.length} with recommended books  ·  ${prepared.bookCount} book links`;
  cell.font = { size: 10, color: { argb: MUTED } };
  report.getRow(4).height = 18;

  report.mergeCells(5, 1, 5, BOOK_COLUMNS.length);
  cell = report.getCell(5, 1);
  cell.value = "Scope: every year level in this program. The on-screen year filter is not applied.";
  cell.font = { size: 10, italic: true, color: { argb: MUTED } };

  let row = 7;

  function subjectBlock(item) {
    const meta = [];
    if (item.semester !== "—") {
      meta.push(
        SEMESTER_LABELS[item.semester] ?? `Semester ${item.semester}`,
      );
    }
    if (item.subject.units != null) {
      meta.push(`${item.subject.units} units`);
    }
    if (item.subject.prerequisites) {
      meta.push(`Prereq: ${item.subject.prerequisites}`);
    }
    subBand(
      report,
      row++,
      `${item.subject.course_code} — ${item.subject.course_title}${
        meta.length ? `  ·  ${meta.join("  ·  ")}` : ""
      }`,
      BOOK_COLUMNS.length,
    );

    if (item.books.length === 0) {
      report.mergeCells(row, 1, row, BOOK_COLUMNS.length);
      cell = report.getCell(row, 1);
      cell.value = NO_BOOK;
      cell.font = { italic: true, size: 10, color: { argb: MUTED } };
      row++;
    } else {
      tableHeader(report, row++, BOOK_COLUMNS);
      item.books.forEach((book, index) => {
        dataRow(
          report,
          row++,
          [
            book.book_name ?? "",
            book.author ?? "",
            book.publish_year ?? "",
            book.copies ?? "",
          ],
          { zebra: index % 2 === 1 },
        );
      });
    }
    row++; // Keep subjects visually separate.
  }

  if (isGenEd) {
    band(report, row++, "General Education — shared subjects", BOOK_COLUMNS.length);
    prepared.subjects.forEach(subjectBlock);
  } else {
    for (const year of data.years ?? []) {
      band(
        report,
        row++,
        `${ORDINALS[year.year_level] ?? year.year_level} Year`,
        BOOK_COLUMNS.length,
      );
      const items = prepared.subjects.filter(
        (item) => item.year_level === year.year_level,
      );
      if (items.length === 0) {
        report.mergeCells(row, 1, row, BOOK_COLUMNS.length);
        cell = report.getCell(row, 1);
        cell.value = "No subjects in this year.";
        cell.font = { italic: true, size: 10, color: { argb: MUTED } };
        row++;
      } else {
        items.forEach(subjectBlock);
      }
    }
  }

  if (prepared.subjects.length === 0) {
    report.mergeCells(row, 1, row, BOOK_COLUMNS.length);
    cell = report.getCell(row, 1);
    cell.value = "No subjects were found for this program.";
    cell.font = { italic: true, size: 10, color: { argb: MUTED } };
  }

  // Flat sheet: one row per recommended book, with a no-book row for subjects
  // that still need a recommendation. This is the sheet to filter or sort.
  const books = workbook.addWorksheet("Recommended books", {
    pageSetup: {
      paperSize: A4_PAPER_SIZE,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: MARGINS,
    },
    views: [{ state: "frozen", ySplit: 4 }],
  });
  REPORT_WIDTHS.forEach((width, index) => {
    books.getColumn(index + 1).width = width;
  });
  books.mergeCells(1, 1, 1, REPORT_COLUMNS.length);
  cell = books.getCell(1, 1);
  cell.value = `Recommended books — ${prepared.code}`;
  cell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  books.mergeCells(2, 1, 2, REPORT_COLUMNS.length);
  cell = books.getCell(2, 1);
  cell.value = prepared.name;
  cell.font = { size: 10, color: { argb: JADE } };
  books.mergeCells(3, 1, 3, REPORT_COLUMNS.length);
  cell = books.getCell(3, 1);
  cell.value = `Generated ${displayTime(generatedAt)} · ${prepared.bookCount} book links · ${prepared.subjectsWithBooks.length} of ${prepared.subjects.length} subjects covered`;
  cell.font = { size: 9, color: { argb: MUTED } };
  tableHeader(books, 4, REPORT_COLUMNS);
  prepared.rows.forEach((item, index) => {
    dataRow(books, 5 + index, rowValues(item), { zebra: index % 2 === 1 });
  });
  books.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: REPORT_COLUMNS.length },
  };

  return { workbook, prepared };
}

export async function downloadCurriculumWorkbook({
  data,
  program,
  isGenEd = false,
  generatedAt = new Date(),
}) {
  const { workbook, prepared } = await buildCurriculumWorkbook({
    data,
    program,
    isGenEd,
    generatedAt,
  });
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], { type: XLSX_MIME }),
    `path-finder-${slugFileName(prepared.code)}-${manilaDate(generatedAt)}.xlsx`,
  );
}
