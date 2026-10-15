// Pure shaping for the attendance drill-down. The RPC sends one tree —
// department → program → year level (at visit), each level with its visits,
// unique visitors, average stay and its five most frequent visitors. These
// helpers turn it into the clickable rows of the three tables and the nodes
// the modal walks one level at a time.
import { yearLabel } from "../attendance/attendanceReportRules.js";

const byVisits = (a, b) => b.count - a.count || a.label.localeCompare(b.label);

// Merge visitor lists by name and keep the biggest counts (the id rides
// along so merged rows can still open the member's record).
function mergedVisitors(lists, limit = 5) {
  const merged = new Map();
  for (const list of lists ?? []) {
    for (const person of list ?? []) {
      const entry = merged.get(person.name) ?? { ...person, count: 0 };
      entry.count += Number(person.count);
      merged.set(person.name, entry);
    }
  }
  return [...merged.values()]
    .sort((a, b) => b.count - a.count || String(a.name).localeCompare(String(b.name)))
    .slice(0, limit);
}

function stayValue(minutes) {
  return minutes == null ? null : Number(minutes);
}

function yearNode(keyPrefix, dept, program, year) {
  return {
    key: `${keyPrefix}|year:${year.label}`,
    label: yearLabel(Number(year.label)),
    sub: `${dept.label} · ${program.label}`,
    count: Number(year.visits),
    unique: Number(year.unique),
    avgMinutes: stayValue(year.avg_minutes),
    visitors: year.visitors ?? [],
    childrenLabel: "",
    children: [],
  };
}

// Rows for the "by department" table: each department with its programs
// (and each program's year levels) as the next drill step.
export function departmentVisitNodes(tree = []) {
  return [...tree]
    .map((dept) => ({
      key: `dept:${dept.label}`,
      label: dept.label,
      count: Number(dept.visits),
      unique: Number(dept.unique),
      avgMinutes: stayValue(dept.avg_minutes),
      visitors: dept.visitors ?? [],
      childrenLabel: "Programs",
      children: [...(dept.programs ?? [])]
        .sort((a, b) => Number(b.visits) - Number(a.visits) || a.label.localeCompare(b.label))
        .map((program) => ({
          key: `dept:${dept.label}|program:${program.label}`,
          label: program.label,
          sub: dept.label,
          count: Number(program.visits),
          unique: Number(program.unique),
          avgMinutes: stayValue(program.avg_minutes),
          visitors: program.visitors ?? [],
          childrenLabel: "Year levels",
          children: [...(program.years ?? [])]
            .sort((a, b) => Number(a.label) - Number(b.label))
            .map((year) => yearNode(`dept:${dept.label}|program:${program.label}`, dept, program, year)),
        })),
    }))
    .sort(byVisits);
}

// Rows for the "by program" table: every program with its department as the
// small line, opening onto its year levels.
export function programVisitNodes(tree = []) {
  return departmentVisitNodes(tree).flatMap((dept) => dept.children).sort(byVisits);
}

// Rows for the "by year level" table: year levels across all programs,
// opening onto the programs that have students in that year.
export function yearLevelVisitNodes(tree = []) {
  const years = new Map();
  for (const dept of tree) {
    for (const program of dept.programs ?? []) {
      for (const year of program.years ?? []) {
        const entry = years.get(year.label) ?? {
          label: year.label,
          count: 0,
          unique: 0,
          stays: [],
          visitors: [],
          children: [],
        };
        entry.count += Number(year.visits);
        entry.unique += Number(year.unique);
        if (year.avg_minutes != null) entry.stays.push(Number(year.avg_minutes));
        entry.visitors.push(...(year.visitors ?? []));
        entry.children.push({
          key: `year:${year.label}|dept:${dept.label}|program:${program.label}`,
          label: program.label,
          sub: dept.label,
          count: Number(year.visits),
          unique: Number(year.unique),
          avgMinutes: stayValue(year.avg_minutes),
          visitors: year.visitors ?? [],
          childrenLabel: "",
          children: [],
        });
        years.set(year.label, entry);
      }
    }
  }
  return [...years.values()]
    .sort((a, b) => Number(a.label) - Number(b.label))
    .map((entry) => ({
      key: `year:${entry.label}`,
      label: yearLabel(Number(entry.label)),
      count: entry.count,
      unique: entry.unique,
      avgMinutes: entry.stays.length
        ? Math.round(
            (entry.stays.reduce((sum, value) => sum + value, 0) / entry.stays.length) * 10,
          ) / 10
        : null,
      visitors: mergedVisitors([entry.visitors]),
      childrenLabel: "Programs",
      children: entry.children.sort(byVisits),
    }));
}
