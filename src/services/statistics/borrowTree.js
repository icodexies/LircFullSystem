// Pure shaping for the borrowing drill-down. The RPC sends one tree —
// department → program → year level, each level with a loan count and its
// top five books. These helpers turn it into the clickable rows of the three
// tables and the nodes the modal walks one level at a time.
import { yearLabel } from "../attendance/attendanceReportRules.js";

// Merge book lists by title and keep the biggest counts. The book id rides
// along so merged rows can still open the book's OPAC window.
function mergedTopBooks(bookLists, limit = 5) {
  const merged = new Map();
  for (const list of bookLists ?? []) {
    for (const book of list ?? []) {
      const entry = merged.get(book.name) ?? {
        id: book.id ?? null,
        name: book.name,
        count: 0,
      };
      if (entry.id == null) entry.id = book.id ?? null;
      entry.count += Number(book.count);
      merged.set(book.name, entry);
    }
  }
  return [...merged.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

const byCount = (a, b) => b.count - a.count || a.label.localeCompare(b.label);

// Rows for the "by department" table: each department with its programs
// (and each program's year levels) as the next drill step.
export function departmentNodes(tree = []) {
  return [...tree]
    .map((dept) => ({
      key: `dept:${dept.label}`,
      label: dept.label,
      count: Number(dept.count),
      books: dept.books ?? [],
      childrenLabel: "Programs",
      children: [...(dept.programs ?? [])]
        .sort((a, b) => Number(b.count) - Number(a.count) || a.label.localeCompare(b.label))
        .map((program) => ({
          key: `dept:${dept.label}|program:${program.label}`,
          label: program.label,
          sub: dept.label,
          count: Number(program.count),
          books: program.books ?? [],
          childrenLabel: "Year levels",
          children: [...(program.years ?? [])]
            .sort((a, b) => Number(a.label) - Number(b.label))
            .map((year) => ({
              key: `dept:${dept.label}|program:${program.label}|year:${year.label}`,
              label: yearLabel(Number(year.label)),
              sub: `${dept.label} · ${program.label}`,
              count: Number(year.count),
              books: year.books ?? [],
              childrenLabel: "",
              children: [],
            })),
        })),
    }))
    .sort(byCount);
}

// Rows for the "by program" table: every program with its department as the
// small line, opening onto its year levels.
export function programNodes(tree = []) {
  return departmentNodes(tree).flatMap((dept) => dept.children).sort(byCount);
}

// Rows for the "by year level" table: year levels across all programs,
// opening onto the programs that have students in that year.
export function yearLevelNodes(tree = []) {
  const years = new Map();
  for (const dept of tree) {
    for (const program of dept.programs ?? []) {
      for (const year of program.years ?? []) {
        const entry = years.get(year.label) ?? {
          label: year.label,
          count: 0,
          books: [],
          children: [],
        };
        entry.count += Number(year.count);
        entry.books.push(...(year.books ?? []));
        entry.children.push({
          key: `year:${year.label}|dept:${dept.label}|program:${program.label}`,
          label: program.label,
          sub: dept.label,
          count: Number(year.count),
          books: year.books ?? [],
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
      books: mergedTopBooks([entry.books]),
      childrenLabel: "Programs",
      children: entry.children.sort(byCount),
    }));
}
