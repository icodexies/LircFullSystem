import { getSupabase } from "../auth/authService.js";

export function usersError(error) {
  if (error?.code === "23505")
    return new Error(
      "An edit for this member is already waiting for admin approval.",
    );
  if (["42883", "PGRST202", "42703", "42P01"].includes(error?.code))
    return new Error(
      "The Users page needs its database setup first. Apply the member edits migration.",
    );
  return new Error(
    error?.message || "The request failed. Check your connection and try again.",
  );
}

// Full member record for the Users page (details + counts).
export async function getMemberProfile(profileId, signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_member_profile", { p_profile_id: profileId })
    .abortSignal(signal);
  if (error) throw usersError(error);
  return data;
}

// One member's attendance history (latest first).
export async function getMemberAttendance(profileId, signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_member_attendance", { p_profile_id: profileId })
    .abortSignal(signal);
  if (error) throw usersError(error);
  return data?.visits ?? [];
}

// Master lists for the edit form (departments, programs, positions).
export async function getMemberOptions(signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_member_options")
    .abortSignal(signal);
  if (error) throw usersError(error);
  return data ?? { department: [], program: [], position: [] };
}

// Submit a profile edit. Admins apply immediately; staff/librarian create a
// request that an admin reviews.
export async function submitMemberChange(profileId, changes) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_request_member_change", {
    p_profile_id: profileId,
    p_changes: changes,
  });
  if (error) throw usersError(error);
  return data ?? { applied: false };
}

// Change requests: admins see all; staff/librarian only their own.
export async function getMemberChangeRequests(onlyMine, signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_member_change_requests", { p_only_mine: onlyMine })
    .abortSignal(signal);
  if (error) throw usersError(error);
  return data?.requests ?? [];
}

// Admin only: approve or reject a member edit request.
export async function reviewMemberChange(requestId, approve) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_review_member_change", {
    p_request_id: requestId,
    p_approve: approve,
  });
  if (error) throw usersError(error);
  return data ?? { ok: true };
}

// Add one member (and, for a student, one annual enrollment row).
export async function addUser(profile, enrollment) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_add_user", {
    p_profile: profile,
    p_enrollment: enrollment,
  });
  if (error) throw usersError(error);
  return data;
}

// Check a whole CSV file first (no saving).
export async function checkUserImport(rows, yearId) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_check_user_import", {
    p_rows: rows,
    p_year_id: yearId,
  });
  if (error) throw usersError(error);
  return data;
}

// Import the checked rows (the database re-checks everything before saving).
export async function importUsers(rows, yearId) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_import_users", {
    p_rows: rows,
    p_year_id: yearId,
  });
  if (error) throw usersError(error);
  return data;
}
