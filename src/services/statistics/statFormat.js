// Small formatters shared by the statistics views and their modals.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2026-10" → "Oct '26"
export function shortMonth(month) {
  const [year, index] = String(month).split("-");
  return `${MONTHS[Number(index) - 1]} '${String(year).slice(2)}`;
}

// 13 → "1 PM"
export function hourLabel(hour) {
  const value = Number(hour);
  const suffix = value < 12 ? "AM" : "PM";
  const display = value % 12 === 0 ? 12 : value % 12;
  return `${display} ${suffix}`;
}

// 476.2 → "7h 56m"
export function stayLabel(minutes) {
  if (minutes == null) return "—";
  const value = Number(minutes);
  if (value < 60) return `${Math.round(value)} min`;
  return `${Math.floor(value / 60)}h ${Math.round(value % 60)}m`;
}

// "2026-08-12" → "Aug 12, 2026"
export function dayLabel(day) {
  if (!day) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "UTC",
    dateStyle: "medium",
  }).format(new Date(`${day}T00:00:00Z`));
}
