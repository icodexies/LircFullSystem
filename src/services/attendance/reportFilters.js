import {
  manilaBoundary,
  ENROLLMENT_STATUSES,
  VISITOR_ROLES,
  PURPOSES,
  MAX_YEAR_LEVEL,
} from "./attendanceRules.js";
export const SEARCH_OPTIONS = [
  ["full_name", "Full name"],
  ["library_id", "Library ID"],
  ["first_name", "First name"],
  ["surname", "Surname"],
  ["middle_initial", "Middle initial"],
  ["suffix", "Suffix"],
];

// Simple words shown in the status menus and in the active-filter chips.
export const STATUS_LABELS = {
  enrolled: "Enrolled",
  unverified: "Not verified",
  leave_of_absence: "On leave",
  withdrawn: "Withdrawn",
  graduated: "Graduated",
  open: "Still inside",
  completed: "Checked out",
};

// Simple words for the visitor roles.
const ROLE_LABELS = {
  student: "Student",
  faculty: "Faculty",
  non_teaching_personnel: "Non-teaching staff",
  admin: "Admin",
  librarian: "Librarian",
};

const levels = Array.from({ length: MAX_YEAR_LEVEL }, (_, i) => [
  String(i + 1),
  String(i + 1),
]);
const statuses = ENROLLMENT_STATUSES.map((value) => [
  value,
  STATUS_LABELS[value] ?? value,
]);

// Attendance filters.
// Every date and time here uses Philippine time (Calamba / Manila):
// "Visit date" days become midnight-to-midnight Manila boundaries in
// reportFilters() below, and the time fields are compared in Manila time.
export const ATTENDANCE_FIELDS = [
  [
    "role",
    "Visitor type",
    VISITOR_ROLES.map((value) => [value, ROLE_LABELS[value] ?? value]),
  ],
  ["year_level", "Year level at visit", [...levels, ["na", "Not a student"]]],
  ["department", "Department", "department"],
  ["program", "Program", "program"],
  ["position", "Position", "position"],
  ["purpose", "Purpose", PURPOSES.map((value) => [value, value])],
  ["purpose_text", "Purpose contains", "text"],
  ["arrival_from_day", "Visit date from", "date"],
  ["arrival_to_day", "Visit date to", "date"],
  ["time_start", "Arrived at or after", "time"],
  ["time_end", "Arrived at or before", "time"],
  ["recorded_by", "Time-in recorded by", "staff"],
  ["checked_out_by", "Time-out recorded by", "checkout_staff"],
  [
    "enrollment_status",
    "Student status now",
    [...statuses, ["na", "Not a student"]],
  ],
];
export const ENROLLMENT_FIELDS = [
  ["cohort", "Card year prefix (for example 23)", "text"],
  ["department", "Department", "department"],
  ["program", "Program", "program"],
  [
    "estimated_level",
    "Estimated level (from card)",
    [...levels, ["none", "Unavailable"]],
  ],
  [
    "validation_state",
    "Validation state",
    [
      ["missing", "No record"],
      ["unverified", "Not verified yet"],
      ["validated", "Validated"],
      ["needs_review", "Needs year-level review"],
    ],
  ],
  ["validated_from_day", "Validated from", "date"],
  ["validated_to_day", "Validated to", "date"],
  ["validator", "Validated by", "staff"],
  ["auth", "Has login account", [["yes", "Yes"], ["no", "No"]]],
];
export function reportFilters(form) {
  const result = {};
  for (const [key, raw] of Object.entries(form)) {
    const value = String(raw).trim();
    if (!value) continue;
    if (key.endsWith("_day"))
      result[key.slice(0, -4)] = manilaBoundary(value, key.endsWith("_to_day"));
    else result[key] = value.slice(0, 1000);
  }
  for (const prefix of ["arrival", "validated"])
    if (
      result[`${prefix}_from`] &&
      result[`${prefix}_to`] &&
      result[`${prefix}_from`] >= result[`${prefix}_to`]
    )
      throw new Error("Date range ends before it starts.");
  if (
    result.time_start &&
    result.time_end &&
    result.time_start > result.time_end
  )
    throw new Error("The arrival time range must not cross midnight.");
  return result;
}
