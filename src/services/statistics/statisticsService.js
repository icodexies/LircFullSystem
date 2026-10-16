import { getSupabase } from "../auth/authService.js";

// The Statistics numbers. Every call takes the header semester's id (null
// falls back to the globally active semester server-side).
export async function getStatisticsOverview(semesterId, signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_statistics_overview", { p_semester_id: semesterId ?? null })
    .abortSignal(signal);
  if (error) {
    if (["42883", "PGRST202", "42703", "42P01"].includes(error?.code))
      throw new Error(
        "Statistics needs its database setup first. Apply the statistics migration.",
      );
    throw new Error(error?.message || "The statistics could not be loaded.");
  }
  return data;
}

// The borrowing detail view: monthly series, rankings and totals for the
// semester's loans.
export async function getBorrowingStatistics(semesterId, signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_statistics_borrowing", { p_semester_id: semesterId ?? null })
    .abortSignal(signal);
  if (error) throw new Error(error?.message || "The borrowing statistics could not be loaded.");
  return data;
}

// The attendance detail view: monthly series, hours, breakdowns and totals
// for the semester's visits.
export async function getAttendanceStatistics(semesterId, signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_statistics_attendance", { p_semester_id: semesterId ?? null })
    .abortSignal(signal);
  if (error) throw new Error(error?.message || "The attendance statistics could not be loaded.");
  return data;
}

// One member's borrowing record for the semester (the borrowers modal):
// frequency, the books they borrowed, and their recent loans.
export async function getBorrowerStatistics(profileId, semesterId, signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_statistics_borrower", {
      p_profile_id: profileId,
      p_semester_id: semesterId ?? null,
    })
    .abortSignal(signal);
  if (error) throw new Error(error?.message || "The borrower's record could not be loaded.");
  return data;
}

// The member view of the Statistics page: the caller's own borrowing and
// attendance records, plus the most borrowed titles (counts only) and the
// library's monthly visits/loans trend. No other member's data is included.
export async function getMyStatistics(semesterId, signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_my_statistics", { p_semester_id: semesterId ?? null })
    .abortSignal(signal);
  if (error) {
    if (["42883", "PGRST202", "42703", "42P01"].includes(error?.code))
      throw new Error(
        "Statistics needs its database setup first. Apply the statistics migration.",
      );
    throw new Error(error?.message || "Your statistics could not be loaded.");
  }
  return data;
}

// The borrower category: how many people borrowed, the top borrowers, who is
// overdue right now, and the borrowers by role and department.
export async function getBorrowersStatistics(semesterId, signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_statistics_borrowers", { p_semester_id: semesterId ?? null })
    .abortSignal(signal);
  if (error) throw new Error(error?.message || "The borrower statistics could not be loaded.");
  return data;
}
