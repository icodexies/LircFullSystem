// Pure date rules for borrowing. The database repeats every check; these
// exist so the form can warn before sending anything. All values are
// datetime-local strings interpreted as Philippine time (Calamba / Manila).
export const MIN_LOAN_START = "2015-01-01T00:00";
export const MAX_LOAN_MS = 366 * 24 * 60 * 60 * 1000;

// Manila "now" as a datetime-local value: YYYY-MM-DDTHH:mm
export function manilaInputValue(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const field = (name) => parts.find((part) => part.type === name).value;
  return `${field("year")}-${field("month")}-${field("day")}T${field("hour")}:${field("minute")}`;
}

// datetime-local value → ISO string (with the +08:00 offset applied), or
// null when the text is malformed or an impossible date/time.
export function manilaInputToIso(value) {
  const text = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) return null;
  const timestamp = Date.parse(`${text}:00+08:00`);
  if (!Number.isFinite(timestamp)) return null;
  // Reject times that roll over (for example February 30 or hour 25).
  return manilaInputValue(new Date(timestamp)) === text
    ? new Date(timestamp).toISOString()
    : null;
}

// Add whole days to a datetime-local value (used for the default due date).
export function addDaysInput(value, days) {
  const iso = manilaInputToIso(value);
  if (!iso) return "";
  return manilaInputValue(new Date(Date.parse(iso) + days * 86400000));
}

// Mirrors the database checks for a return. Returns "" when fine.
export function returnDateError({ borrowedAt, returned }) {
  const returnedIso = manilaInputToIso(returned);
  if (!returnedIso) return "Pick a valid return date/time.";
  const returnedMs = Date.parse(returnedIso);
  if (borrowedAt && returnedMs < Date.parse(borrowedAt))
    return "The return date/time cannot be before it was borrowed.";
  if (returnedMs > Date.now() + 86400000)
    return "The return date/time cannot be in the future.";
  return "";
}

// Mirrors the database checks. Returns "" when the values are fine.
export function loanDateError({ start, due, returned = "" }) {
  const startIso = manilaInputToIso(start);
  const dueIso = manilaInputToIso(due);
  if (!startIso || !dueIso) return "Provide the start and due date/time.";
  const startMs = Date.parse(startIso);
  const dueMs = Date.parse(dueIso);
  if (startMs < Date.parse(`${MIN_LOAN_START}:00+08:00`))
    return "The start date/time looks invalid. Use a real past or present date.";
  if (startMs > Date.now() + 86400000)
    return "The start date/time cannot be in the future.";
  if (dueMs <= startMs)
    return "The due date/time must be after the start date/time.";
  if (dueMs - startMs > MAX_LOAN_MS)
    return "A loan longer than one year looks like a mistake. Check the dates.";
  if (returned) {
    const returnedIso = manilaInputToIso(returned);
    if (!returnedIso) return "The return date/time is not valid.";
    const returnedMs = Date.parse(returnedIso);
    if (returnedMs < startMs)
      return "The return date/time cannot be before the start.";
    if (returnedMs > Date.now() + 86400000)
      return "The return date/time cannot be in the future.";
  }
  return "";
}
