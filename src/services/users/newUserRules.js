// Pure rules for the Add User window (both tabs). The database repeats every
// rule (lirc_add_user / lirc_check_user_import / lirc_import_users), so the
// messages stay the same.
import { csvCell, estimatedLevel } from "../attendance/attendanceRules.js";
import { ROLES, ROLE_LABELS } from "../../routes/roles.js";

export const MEMBER_LIMITS = {
  library_id: 120,
  first_name: 100,
  surname: 100,
  middle_initial: 2,
  suffix: 20,
};

export const ROLE_OPTIONS = [
  { value: ROLES.STUDENT, label: ROLE_LABELS[ROLES.STUDENT] },
  { value: ROLES.FACULTY, label: ROLE_LABELS[ROLES.FACULTY] },
  { value: ROLES.STAFF, label: ROLE_LABELS[ROLES.STAFF] },
  {
    value: ROLES.NON_TEACHING_PERSONNEL,
    label: ROLE_LABELS[ROLES.NON_TEACHING_PERSONNEL],
  },
  { value: ROLES.LIBRARIAN, label: ROLE_LABELS[ROLES.LIBRARIAN] },
  { value: ROLES.ADMIN, label: ROLE_LABELS[ROLES.ADMIN] },
];

// Admin access can only be assigned by an admin.
export function roleOptions(isAdmin) {
  return isAdmin
    ? ROLE_OPTIONS
    : ROLE_OPTIONS.filter((row) => row.value !== ROLES.ADMIN);
}

export function roleLabel(value) {
  return ROLE_LABELS[value] ?? value ?? "";
}

export function isStudentRole(role) {
  return String(role ?? "").trim().toLowerCase() === ROLES.STUDENT;
}

export function ordinalLevel(level) {
  return { 1: "1st year", 2: "2nd year", 3: "3rd year", 4: "4th year" }[
    level
  ] ?? "";
}

// The library card's suggested level for one academic year (or "").
export function cardEstimate(libraryId, year) {
  const level = estimatedLevel(libraryId, year?.start_year);
  return level ? ordinalLevel(level) : "";
}

const text = (value) => String(value ?? "").trim();

// Client mirror of lirc_private.clean_new_member. Returns { error, clean }.
export function validateNewMember(form, { isAdmin } = {}) {
  const clean = {
    library_id: text(form.library_id),
    first_name: text(form.first_name),
    surname: text(form.surname),
    middle_initial: text(form.middle_initial),
    suffix: text(form.suffix),
    role: text(form.role).toLowerCase(),
    department_id: text(form.department_id),
    program_id: text(form.program_id),
    position_classification_id: text(form.position_classification_id),
  };
  if (!clean.library_id) return { error: "Library ID is required." };
  if (clean.library_id.length > MEMBER_LIMITS.library_id)
    return {
      error: `Library ID must be ${MEMBER_LIMITS.library_id} characters or fewer.`,
    };
  if (!clean.first_name) return { error: "First name is required." };
  if (clean.first_name.length > MEMBER_LIMITS.first_name)
    return {
      error: `First name must be ${MEMBER_LIMITS.first_name} characters or fewer.`,
    };
  if (!clean.surname) return { error: "Surname is required." };
  if (clean.surname.length > MEMBER_LIMITS.surname)
    return {
      error: `Surname must be ${MEMBER_LIMITS.surname} characters or fewer.`,
    };
  if (clean.middle_initial.length > MEMBER_LIMITS.middle_initial)
    return {
      error: `Middle initial must be ${MEMBER_LIMITS.middle_initial} characters or fewer.`,
    };
  if (clean.suffix.length > MEMBER_LIMITS.suffix)
    return {
      error: `Suffix must be ${MEMBER_LIMITS.suffix} characters or fewer.`,
    };
  if (!roleOptions(isAdmin).some((row) => row.value === clean.role))
    return {
      error:
        clean.role === ROLES.ADMIN
          ? "Only an admin can add another admin."
          : "Choose a valid role.",
    };
  // Only the fields relevant to the role are sent.
  if (!isStudentRole(clean.role)) clean.program_id = "";
  else clean.position_classification_id = "";
  return { error: "", clean };
}

// ---------------------------------------------------------------------------
// CSV tab
// ---------------------------------------------------------------------------
export const CSV_COLUMNS = [
  "library_id",
  "first_name",
  "surname",
  "middle_initial",
  "suffix",
  "role",
  "department_id",
  "program_id",
  "position_classification_id",
];
export const STUDENT_EXTRA_COLUMNS = ["year_level", "year_level_note"];

export function buildTemplateCsv(kind) {
  const headers =
    kind === "student"
      ? [...CSV_COLUMNS, ...STUDENT_EXTRA_COLUMNS]
      : [...CSV_COLUMNS];
  return `${headers.join(",")}\r\n`;
}

// A small CSV reader: quoted fields, doubled quotes, \r\n, and it keeps the
// line number each record started on (for row-numbered problems).
export function parseCsv(text) {
  const source = String(text ?? "").replace(/^\uFEFF/, "");
  const rows = [];
  let values = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (inQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === "\n") line += 1;
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      values.push(field);
      field = "";
    } else if (ch === "\n") {
      values.push(field);
      field = "";
      rows.push({ line: recordLine, values });
      values = [];
      line += 1;
      recordLine = line;
    } else if (ch === "\r") {
      // Ignored; \r\n is handled by the \n branch.
    } else {
      field += ch;
    }
  }
  if (field !== "" || values.length > 0) {
    values.push(field);
    rows.push({ line: recordLine, values });
  }
  return rows;
}

// Map a parsed CSV to row objects (with file row numbers). Unknown columns
// are ignored; blank lines are skipped.
export function rowsFromCsv(parsed) {
  if (!parsed.length) return { error: "The file is empty.", rows: [] };
  const header = parsed[0].values.map((value) => value.trim().toLowerCase());
  for (const required of ["library_id", "first_name", "surname", "role"]) {
    if (!header.includes(required))
      return {
        error:
          "The header row must include library_id, first_name, surname and role. Download the template and fill it in.",
        rows: [],
      };
  }
  const known = [...CSV_COLUMNS, ...STUDENT_EXTRA_COLUMNS];
  const rows = [];
  for (const record of parsed.slice(1)) {
    if (record.values.every((value) => value.trim() === "")) continue;
    const row = { row: record.line };
    header.forEach((column, index) => {
      if (known.includes(column)) row[column] = (record.values[index] ?? "").trim();
    });
    rows.push(row);
  }
  return { error: "", rows };
}

// CSV of the failed rows (row number, library ID, reason).
export function buildErrorReportCsv(results) {
  const lines = ["row,library_id,reason"];
  for (const result of (results ?? []).filter((row) => !row.ok))
    lines.push(
      `${result.row},${csvCell(result.library_id)},${csvCell(result.reason)}`,
    );
  return `${lines.join("\r\n")}\r\n`;
}
