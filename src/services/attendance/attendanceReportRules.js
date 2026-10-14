// Pure helpers for the attendance Excel report: grouping the filtered visits
// into the summary sections and describing the applied filters in words.
// The server sends the rows; everything here is shaping only.
import { ROLE_LABELS } from "../../routes/roles.js";
import { ATTENDANCE_FIELDS, STATUS_LABELS } from "./reportFilters.js";
import { displayTime } from "./attendanceRules.js";

const UNASSIGNED = "Unassigned";
const NO_DEPARTMENT = "(No department)";
const NO_PROGRAM = "(No program)";
const SKIP_FILTER_KEYS = new Set(["search_by", "sort", "direction"]);

const FIELD_LABELS = new Map(
  ATTENDANCE_FIELDS.map(([key, label]) => [key, label]),
);
const OPTION_LABELS = new Map(
  ATTENDANCE_FIELDS.flatMap(([, , options]) =>
    Array.isArray(options) ? options : [],
  ),
);

const YEAR_LABELS = {
  1: "1st year",
  2: "2nd year",
  3: "3rd year",
  4: "4th year",
};
const YEAR_ORDER = ["1st year", "2nd year", "3rd year", "4th year", "Year not set"];

export function yearLabel(level) {
  return YEAR_LABELS[Number(level)] ?? (level ? `Year ${level}` : "Year not set");
}

function countBy(rows, pick) {
  const map = new Map();
  for (const row of rows) {
    const key = pick(row) || UNASSIGNED;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

// Year lines in study order (unknown labels after them, alphabetical).
function yearLines(years) {
  return [...years.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => {
      const ai = YEAR_ORDER.indexOf(a.label);
      const bi = YEAR_ORDER.indexOf(b.label);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) ||
        a.label.localeCompare(b.label);
    });
}

// One tree: department → program → (year levels for students + one
// "Faculty & staff" line for non-student visits). Every department is
// grouped in a single entry, so the report reads top-down.
export function departmentTree(rows = []) {
  const departments = new Map();
  for (const row of rows) {
    const department = row.department || NO_DEPARTMENT;
    const dept = departments.get(department) ?? {
      department,
      count: 0,
      programs: new Map(),
    };
    dept.count += 1;
    const program = row.program || NO_PROGRAM;
    const prog = dept.programs.get(program) ?? {
      label: program,
      count: 0,
      years: new Map(),
      staff: 0,
    };
    prog.count += 1;
    if (row.role === "student") {
      const label = yearLabel(row.year_level);
      prog.years.set(label, (prog.years.get(label) ?? 0) + 1);
    } else {
      prog.staff += 1;
    }
    dept.programs.set(program, prog);
    departments.set(department, dept);
  }
  return [...departments.values()]
    .map((dept) => ({
      department: dept.department,
      count: dept.count,
      programs: [...dept.programs.values()]
        .map((prog) => ({
          label: prog.label,
          count: prog.count,
          years: yearLines(prog.years),
          staff: prog.staff,
        }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    }))
    .sort((a, b) => b.count - a.count || a.department.localeCompare(b.department));
}

export function summarizeAttendance(rows = []) {
  const total = rows.length;
  const uniqueVisitors = new Set(
    rows.map((row) => row.user_profile_id).filter(Boolean),
  ).size;

  return {
    total,
    uniqueVisitors,
    byRole: countBy(rows, (row) => ROLE_LABELS[row.role] ?? row.role),
    byPurpose: countBy(rows, (row) => row.purpose),
    departments: departmentTree(rows),
    byPosition: countBy(
      rows.filter((row) => row.role !== "student" && row.position),
      (row) => row.position,
    ),
  };
}

// "Visitor type: Student", "Visit date from: Oct 14, 2026" … in the order of
// the filter fields. Empty object → empty list (the report says so itself).
export function describeAttendanceFilters(filters = {}) {
  const lines = [];
  for (const [key, raw] of Object.entries(filters)) {
    if (SKIP_FILTER_KEYS.has(key)) continue;
    const value = String(raw ?? "").trim();
    if (!value) continue;
    if (key === "search") {
      lines.push(`Search: ${value}`);
      continue;
    }
    if (key === "status") {
      lines.push(`Visit status: ${STATUS_LABELS[value] ?? value}`);
      continue;
    }
    const label =
      FIELD_LABELS.get(key) ??
      FIELD_LABELS.get(`${key}_day`) ??
      key.replaceAll("_", " ");
    let text = OPTION_LABELS.get(value) ?? value;
    if (key.endsWith("_from") || key.endsWith("_to")) text = displayTime(value);
    lines.push(`${label}: ${text}`);
  }
  return lines;
}
