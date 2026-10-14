// Small shared helpers for the personnel dashboard. The server aggregates
// everything; these only shape numbers and labels for display.

export function signInSourceNote(source) {
  return source === "audit"
    ? "From the Supabase auth audit log (logins and logouts)."
    : "From session records only — sign-outs and denied attempts appear once “Write audit logs to the database” is enabled in the Supabase dashboard.";
}

// ---------------------------------------------------------------------------
// Chart helpers (pure). Palette only uses the LIRC colors.
// ---------------------------------------------------------------------------
export const CHART_COLORS = [
  "#0B1330",
  "#0F8A6B",
  "#3B4A86",
  "#12A47E",
  "#5BBA9E",
  "#94A3B8",
  "#CBD5E1",
  "#0B6B52",
];

export const GROUP_LABELS = {
  inventory: "Inventory",
  loans: "Borrowing",
  users: "Members",
  member_change: "Member changes",
  enrollment: "Library validation",
  catalog: "Catalog",
  attendance: "Attendance",
  semesters: "Academic periods",
  barcode: "Barcode",
  other: "Other",
};

// Donut segments from the server group counts: non-zero only, biggest first,
// palette colors, percentage with the count kept alongside.
export function donutSegments(groups) {
  const rows = (groups ?? [])
    .map((group) => ({ key: group?.key, count: Number(group?.count ?? 0) }))
    .filter((group) => group.count > 0)
    .sort((a, b) => b.count - a.count);
  const total = rows.reduce((sum, group) => sum + group.count, 0);
  let kept = rows;
  if (rows.length > CHART_COLORS.length) {
    const head = rows.slice(0, CHART_COLORS.length - 1);
    const rest = rows.slice(CHART_COLORS.length - 1);
    kept = [
      ...head,
      { key: "other", count: rest.reduce((sum, group) => sum + group.count, 0) },
    ];
  }
  return kept.map((group, index) => ({
    key: group.key,
    label: GROUP_LABELS[group.key] ?? group.key,
    value: group.count,
    pct: total > 0 ? Math.round((group.count / total) * 1000) / 10 : 0,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));
}

// Daily bars scaled to the busiest day; small days keep a visible sliver.
export function barSeries(daily) {
  const rows = daily ?? [];
  const max = rows.reduce(
    (value, day) => Math.max(value, Number(day?.count ?? 0)),
    0,
  );
  return {
    max,
    bars: rows.map((day) => {
      const count = Number(day?.count ?? 0);
      return {
        day: day?.day,
        count,
        pct: count > 0 && max > 0 ? Math.max((count / max) * 100, 6) : 0,
      };
    }),
  };
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function shortDay(day) {
  const parts = String(day ?? "").split("-");
  const month = Number(parts[1]);
  const date = Number(parts[2]);
  if (!month || !date) return String(day ?? "");
  return `${MONTHS[month - 1]} ${date}`;
}
