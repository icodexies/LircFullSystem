// Display rules for fines. The day count mirrors the database's
// lirc_private.days_late_between: a started day counts, minimum one.

// Whole days late between a due time and a later time (both ISO strings or
// Date values). Returns 0 when not late.
export function daysLateBetween(due, at) {
  const dueMs = new Date(due).getTime();
  const atMs = new Date(at).getTime();
  if (!Number.isFinite(dueMs) || !Number.isFinite(atMs) || atMs <= dueMs)
    return 0;
  return Math.max(1, Math.ceil((atMs - dueMs) / 86400000));
}

// ₱ with two decimals: 15 -> "₱15.00".
export function peso(value) {
  return `₱${Number(value ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// "3 days late" / "1 day late".
export function daysLabel(days) {
  const n = Number(days ?? 0);
  return `${n} day${n === 1 ? "" : "s"} late`;
}
