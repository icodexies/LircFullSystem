import { getSupabase } from "../auth/authService.js";
import { normalizeCard, enrollmentPayload } from "./attendanceRules.js";
export function attendanceError(error) {
  if (error?.code === "23505")
    return new Error(
      "An open visit or library validation already exists. Scan again to load the current record.",
    );
  if (["42883", "PGRST202", "42703", "42P01"].includes(error?.code))
    return new Error(
      "Annual attendance setup is incomplete. Apply the annual migration and reporting migration first.",
    );
  return new Error(
    error?.message ||
      "The request failed. Check your connection and try again.",
  );
}
export async function lookupCard(card, signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lookup_attendance_card", { p_library_id: normalizeCard(card) })
    .abortSignal(signal);
  if (error) throw attendanceError(error);
  return data;
}
export async function recordTimeIn(profileId, semesterId, purpose) {
  if (
    !profileId ||
    !semesterId ||
    !purpose?.trim() ||
    purpose.trim().length > 250
  )
    throw new Error("Visitor, active semester and purpose are required.");
  const client = await getSupabase();
  const { data, error } = await client
    .from("attendance")
    .insert({
      user_profile_id: profileId,
      semester_id: semesterId,
      purpose_of_visit: purpose.trim(),
    })
    .select()
    .single();
  if (error) throw attendanceError(error);
  return data;
}
export async function recordTimeOut(id) {
  if (!id) throw new Error("An open visit is required.");
  const client = await getSupabase();
  const { data, error } = await client
    .from("attendance")
    .update({ time_out: new Date().toISOString() })
    .eq("id", id)
    .is("time_out", null)
    .select()
    .maybeSingle();
  if (error) throw attendanceError(error);
  if (!data)
    throw new Error("This visit was already checked out. Refresh the records.");
  return data;
}
export async function saveEnrollment(profile, year, enrollment, form) {
  const payload = enrollmentPayload(form, profile, year);
  const client = await getSupabase();
  const query = enrollment
    ? client.from("student_enrollments").update(payload).eq("id", enrollment.id)
    : client
        .from("student_enrollments")
        .insert({
          ...payload,
          user_profile_id: profile.id,
          academic_year_id: year.id,
        });
  const { data, error } = await query.select().single();
  if (error) throw attendanceError(error);
  return data;
}
export async function getReport(
  kind,
  periodId,
  filters,
  page,
  signal,
  pageSize = 20,
) {
  if (!periodId) throw new Error("Choose a period before loading records.");
  if (!["attendance", "enrollment", "open"].includes(kind))
    throw new Error("Invalid report.");
  const client = await getSupabase();
  const parameters = {
    p_filters: filters,
    p_page: page,
    p_page_size: pageSize,
  };
  if (kind === "enrollment") parameters.p_academic_year_id = periodId;
  else parameters.p_semester_id = periodId;
  const { data, error } = await client
    .rpc(
      kind === "enrollment"
        ? "lirc_annual_enrollment_report"
        : "lirc_attendance_report",
      {
        ...parameters,
        ...(kind === "open" ? { p_open_across_semesters: true } : {}),
      },
    )
    .abortSignal(signal);
  if (error) throw attendanceError(error);
  return data;
}
export async function getStaffOptions(signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_attendance_options")
    .abortSignal(signal);
  if (error) throw attendanceError(error);
  return data;
}

// Every school year for one student: status, level, validator and any
// pending change request. Used by the annual validation window.
export async function getValidationHistory(profileId, signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_student_validation_history", { p_profile_id: profileId })
    .abortSignal(signal);
  if (error) throw attendanceError(error);
  return data ?? { years: [] };
}

// Ask for a past school year's status to change. Admins apply immediately;
// librarians get { applied: false } and an admin is notified for approval.
export async function requestEnrollmentChange(profileId, yearId, status) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_request_enrollment_change", {
    p_profile_id: profileId,
    p_academic_year_id: yearId,
    p_status: status,
  });
  if (error) throw attendanceError(error);
  return data ?? { applied: false };
}

// Admin only: approve or reject a pending change request.
export async function reviewEnrollmentChange(requestId, approve) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_review_enrollment_change", {
    p_request_id: requestId,
    p_approve: approve,
  });
  if (error) throw attendanceError(error);
  return data ?? { ok: true };
}

// Admin only: how many past-year changes are waiting for approval.
export async function getPendingApprovalCount(signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_pending_change_count")
    .abortSignal(signal);
  if (error) throw attendanceError(error);
  return Number(data ?? 0);
}
