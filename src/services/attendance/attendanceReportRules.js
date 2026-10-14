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
    visitors: visitorSections(rows),
  };
}

// ---------------------------------------------------------------------------
// Unique visitors: one line per person with how many times they visited,
// organized the way the library reads its records:
//   * students — department → program (year level from their latest visit)
//   * faculty and non-teaching personnel — by position
//   * library personnel (staff / librarian / admin) — by role
//   * guests — one line per guest card + typed name
// Every person carries the info columns the sheet shows (card, type, year
// level, department, position) plus their entry count.
// ---------------------------------------------------------------------------
const NO_POSITION = "(No position)";
const LIBRARY_ROLES = ["staff", "librarian", "admin"];

function personSort(a, b) {
  return (
    b.visits - a.visits ||
    String(a.name ?? "").localeCompare(String(b.name ?? ""))
  );
}

function groupBy(persons, labelOf) {
  const groups = new Map();
  for (const person of persons) {
    const label = labelOf(person);
    const list = groups.get(label) ?? [];
    list.push(person);
    groups.set(label, list);
  }
  return [...groups.entries()]
    .map(([label, list]) => ({
      label,
      visits: list.reduce((sum, person) => sum + person.visits, 0),
      persons: list.sort(personSort),
    }))
    .sort((a, b) => b.visits - a.visits || a.label.localeCompare(b.label));
}

export function visitorSections(rows = []) {
  const people = new Map();
  for (const row of rows) {
    const guest = Boolean(row.guest_name);
    const key = guest
      ? `guest:${row.user_profile_id ?? row.library_id ?? ""}:${String(row.guest_name).trim().toLowerCase()}`
      : `user:${row.user_profile_id ?? row.library_id ?? row.full_name ?? ""}`;
    const person = people.get(key) ?? {
      name: guest ? String(row.guest_name).trim() : row.full_name,
      library_id: row.library_id,
      role: row.role,
      guest,
      year_level: null,
      department: row.department || "",
      program: row.program || "",
      position: row.position || "",
      visits: 0,
      latest: "",
    };
    person.visits += 1;
    const moment = String(row.time_in ?? "");
    if (moment > person.latest) {
      person.latest = moment;
      if (!guest && row.role === "student")
        person.year_level = row.year_level ?? null;
    }
    people.set(key, person);
  }
  const list = [...people.values()];

  const studentDepartments = new Map();
  for (const person of list.filter((p) => p.role === "student" && !p.guest)) {
    const department = person.department || NO_DEPARTMENT;
    const program = person.program || NO_PROGRAM;
    if (!studentDepartments.has(department))
      studentDepartments.set(department, new Map());
    const programs = studentDepartments.get(department);
    const persons = programs.get(program) ?? [];
    persons.push(person);
    programs.set(program, persons);
  }
  const students = [...studentDepartments.entries()]
    .map(([department, programs]) => {
      const programList = [...programs.entries()]
        .map(([program, persons]) => ({
          program,
          visits: persons.reduce((sum, person) => sum + person.visits, 0),
          persons: persons.sort(personSort),
        }))
        .sort(
          (a, b) =>
            b.visits - a.visits || a.program.localeCompare(b.program),
        );
      return {
        department,
        students: programList.reduce(
          (sum, program) => sum + program.persons.length,
          0,
        ),
        visits: programList.reduce((sum, program) => sum + program.visits, 0),
        programs: programList,
      };
    })
    .sort((a, b) => b.visits - a.visits || a.department.localeCompare(b.department));

  const without = (role) => list.filter((p) => !p.guest && p.role === role);
  const sections = [
    {
      key: "faculty",
      title: "Faculty — by position",
      groups: groupBy(without("faculty"), (p) => p.position || NO_POSITION),
    },
    {
      key: "non_teaching",
      title: "Non-teaching personnel — by position",
      groups: groupBy(
        without("non_teaching_personnel"),
        (p) => p.position || NO_POSITION,
      ),
    },
    {
      key: "library",
      title: "Library personnel",
      groups: groupBy(
        list.filter((p) => !p.guest && LIBRARY_ROLES.includes(p.role)),
        (p) => ROLE_LABELS[p.role] ?? p.role,
      ),
    },
    {
      key: "guests",
      title: "Guests — one line per guest card and typed name",
      groups: groupBy(list.filter((p) => p.guest), () => ""),
    },
    {
      key: "other",
      title: "Other visitors",
      groups: groupBy(
        list.filter(
          (p) =>
            !p.guest &&
            !["student", "faculty", "non_teaching_personnel"].includes(p.role) &&
            !LIBRARY_ROLES.includes(p.role),
        ),
        (p) => ROLE_LABELS[p.role] ?? p.role,
      ),
    },
  ].filter((section) => section.groups.length > 0);

  return { total: list.length, students, sections };
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
