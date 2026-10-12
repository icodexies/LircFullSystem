export function chooseSemester(rows, savedId) {
  return (
    rows.find((row) => String(row.id) === String(savedId)) ??
    rows.find((row) => row.is_active) ??
    null
  );
}
export function periodPreferenceKey(userId) {
  return `lirc:viewing-semester:${userId}`;
}
export function applySemesterFilter(request, id) {
  if (!id) throw new Error("Select a semester first.");
  return request.eq("semester_id", id);
}
export function periodLabel(period) {
  return period
    ? `${period.academic_year?.name ?? "Academic year"} · ${period.name}`
    : "No semester selected";
}
