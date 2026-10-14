export const MAX_YEAR_LEVEL = 4;
export function isSupportedYearLevel(level) {
  return Number.isInteger(level) && level >= 1 && level <= MAX_YEAR_LEVEL;
}
export function needsEnrollmentReview(enrollment) {
  return (
    enrollment?.status === "enrolled" &&
    !isSupportedYearLevel(enrollment.year_level)
  );
}
export function enrollmentLevelLabel(enrollment) {
  if (needsEnrollmentReview(enrollment))
    return "Needs review — save again to set it";
  return enrollment?.year_level ?? "Not verified";
}
export const OPERATOR_ROLES = ["admin", "librarian"];
export const VISITOR_ROLES = [
  "student",
  "faculty",
  "non_teaching_personnel",
  "admin",
  "librarian",
];
export const PURPOSES = [
  "Reading",
  "Studying",
  "Research",
  "Borrowing/Returning",
  "Computer Use",
  "Other",
];
export const ENROLLMENT_STATUSES = [
  "enrolled",
  "unverified",
  "leave_of_absence",
  "withdrawn",
  "graduated",
];
export function normalizeCard(value) {
  let card = String(value ?? "").trim();
  if (card.startsWith("*") && card.endsWith("*") && card.length > 2)
    card = card.slice(1, -1);
  if (!card || card.length > 120)
    throw new Error("Enter a valid library card.");
  return card;
}
export function estimatedLevel(card, startYear) {
  if (!/^\d{2}-/.test(String(card)) || !startYear) return null;
  const level =
    Number(startYear) - (2000 + Number(String(card).slice(0, 2))) + 1;
  return isSupportedYearLevel(level) ? level : null;
}
export function manilaDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const field = (name) => parts.find((part) => part.type === name).value;
  return `${field("year")}-${field("month")}-${field("day")}`;
}
// True when a school year has already ended in Philippine time. Past school
// years change only through the admin approval workflow.
export function isPastAcademicYear(year, today = manilaDate()) {
  return Boolean(year?.ends_on) && today > year.ends_on;
}
export function manilaBoundary(day, nextDay = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Enter a valid date.");
  const timestamp = Date.parse(`${day}T00:00:00+08:00`);
  if (!Number.isFinite(timestamp) || manilaDate(new Date(timestamp)) !== day)
    throw new Error("Enter a valid date.");
  return new Date(timestamp + (nextDay ? 86400000 : 0)).toISOString();
}
export function displayTime(value) {
  return value
    ? new Intl.DateTimeFormat("en-PH", {
        timeZone: "Asia/Manila",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
}
export function personName(profile) {
  return [
    profile?.first_name,
    profile?.middle_initial,
    profile?.surname,
    profile?.suffix,
  ]
    .filter(Boolean)
    .join(" ");
}
export function timeInReason(
  preview,
  selectedId,
  purpose,
  other,
  now = new Date(),
) {
  if (!preview?.profile) return "Scan a library card first.";
  const period = preview.active_semester;
  if (!period)
    return "No globally active semester. Configure it in Academic periods.";
  if (String(selectedId) !== String(period.id))
    return "You are viewing a historical semester. View the active semester to record time in.";
  const today = manilaDate(now);
  if (today < period.starts_on || today > period.ends_on)
    return "The active semester is outside its school dates. Ask staff to configure it.";
  if (!VISITOR_ROLES.includes(preview.profile.role))
    return "This visitor role is not supported by the attendance schema.";
  if (preview.open_visit)
    return "This visitor already has an open visit. Record time out first.";
  if (preview.profile.role === "student") {
    const enrollment = preview.enrollment;
    if (!enrollment || enrollment.status === "unverified")
      return "Student is not verified for the active academic year. Complete their library validation first.";
    if (needsEnrollmentReview(enrollment))
      return "Year level needs review. Save the library validation again so the system can set it from the card.";
    if (
      enrollment.status !== "enrolled" ||
      !enrollment.validated_at ||
      !enrollment.year_level
    )
      return "Student's library validation is not complete for this academic year.";
  }
  if (!PURPOSES.includes(purpose)) return "Choose the purpose of this visit.";
  if (purpose === "Other" && !other.trim())
    return "Describe the other purpose.";
  if ((purpose === "Other" ? other.trim() : purpose).length > 250)
    return "Purpose must be 250 characters or fewer.";
  return "";
}
export function enrollmentPayload(form, profile, year) {
  if (profile.role !== "student")
    throw new Error("Only students have library validation.");
  if (!year?.id || !ENROLLMENT_STATUSES.includes(form.status))
    throw new Error("Choose an academic year and status.");
  // Staff choose the status only. The database derives the year level from
  // the library card and any recorded leave-of-absence years.
  return { status: form.status };
}
export function csvCell(value) {
  let text = String(value ?? "");
  if (/^\s*[=+@-]/.test(text) || /^[\t\r]/.test(text)) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
}
