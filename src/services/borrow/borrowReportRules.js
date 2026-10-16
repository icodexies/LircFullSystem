// Display rules for the Book Borrow report: filter labels, the applied-filter
// lines shown in the Excel report, and the summary the workbook needs.
import { ROLE_LABELS } from "../../routes/roles.js";
import { manilaDate } from "../attendance/attendanceRules.js";

export const BORROW_STATUSES = [
  ["", "All records"],
  ["open", "Still out"],
  ["overdue", "Overdue (still out)"],
  ["returned", "Returned"],
  ["late", "Returned late"],
];

export const BORROW_SORTS = [
  ["borrowed", "Date borrowed"],
  ["due", "Due date"],
  ["returned", "Date returned"],
  ["member", "Member name"],
  ["book", "Book title"],
];

export const BORROW_SEARCH_FIELDS = [
  ["member", "Member (name or card)"],
  ["book", "Book (title or accession)"],
];

export const BORROW_ROLE_OPTIONS = [
  ["", "All roles"],
  ["student", ROLE_LABELS.student],
  ["faculty", ROLE_LABELS.faculty],
  ["non_teaching_personnel", ROLE_LABELS.non_teaching_personnel],
  ["staff", ROLE_LABELS.staff],
  ["librarian", ROLE_LABELS.librarian],
  ["admin", ROLE_LABELS.admin],
  ["guest", ROLE_LABELS.guest],
];

// The status text one row shows in tables and the workbook.
export function rowStatusLabel(row) {
  if (!row.returned_at) {
    return row.is_overdue
      ? `Overdue by ${daysText(row.days_overdue)}`
      : "Still out";
  }
  return row.days_late != null && row.days_late >= 0
    ? `Returned · ${daysText(row.days_late)} late`
    : "Returned";
}

function daysText(days) {
  const value = Math.max(0, Math.floor(Number(days) || 0));
  return value === 1 ? "1 day" : `${value} days`;
}

// Human lines for the Excel report and filter chips (plain form values).
export function describeBorrowFilters(form = {}) {
  const lines = [];
  const range = (label, from, to) => {
    if (!from && !to) return;
    lines.push(`${label}: ${from || "…"} → ${to || "…"}`);
  };
  range("Borrowed", form.borrowed_from, form.borrowed_to);
  range("Due", form.due_from, form.due_to);
  range("Returned", form.returned_from, form.returned_to);
  const status = BORROW_STATUSES.find(([value]) => value === (form.status ?? ""));
  if (status && status[0]) lines.push(`Status: ${status[1]}`);
  if (form.role) lines.push(`Member role: ${ROLE_LABELS[form.role] ?? form.role}`);
  if (form.search?.trim())
    lines.push(
      `Search (${form.search_by === "book" ? "book" : "member"}): “${form.search.trim()}”`,
    );
  const sort = BORROW_SORTS.find(([value]) => value === (form.sort ?? "borrowed"));
  if (sort)
    lines.push(
      `Sort: ${sort[1]}, ${form.direction === "asc" ? "oldest first" : "newest first"}`,
    );
  return lines;
}

// The workbook summary, computed from the exported rows.
export function summarizeBorrow(rows) {
  const list = rows ?? [];
  const total = list.length;
  const open = list.filter((row) => !row.returned_at).length;
  const overdue = list.filter((row) => !row.returned_at && row.is_overdue).length;
  const returned = list.filter((row) => row.returned_at).length;
  const late = list.filter(
    (row) => row.returned_at && row.days_late != null && row.days_late >= 0,
  ).length;
  const onTime = returned - late;
  const uniqueMembers = new Set(list.map((row) => row.member_id)).size;
  const kept = list
    .filter((row) => row.days_kept != null)
    .map((row) => Number(row.days_kept));
  const avgDaysKept = kept.length
    ? Math.round((kept.reduce((sum, value) => sum + value, 0) / kept.length) * 10) / 10
    : null;

  const roleMap = new Map();
  for (const row of list)
    roleMap.set(row.role, (roleMap.get(row.role) ?? 0) + 1);
  const byRole = [...roleMap.entries()]
    .map(([role, count]) => ({ label: ROLE_LABELS[role] ?? role, count }))
    .sort((a, b) => b.count - a.count);

  const monthMap = new Map();
  for (const row of list) {
    const label = manilaDate(new Date(row.borrowed_at)).slice(0, 7);
    monthMap.set(label, (monthMap.get(label) ?? 0) + 1);
  }
  const byMonth = [...monthMap.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const bookMap = new Map();
  for (const row of list)
    bookMap.set(row.book_name, (bookMap.get(row.book_name) ?? 0) + 1);
  const topBooks = [...bookMap.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 15);

  return {
    total,
    open,
    overdue,
    returned,
    late,
    onTime,
    uniqueMembers,
    avgDaysKept,
    byRole,
    byMonth,
    topBooks,
  };
}
