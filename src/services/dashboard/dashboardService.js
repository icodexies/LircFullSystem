import { getSupabase } from "../auth/authService.js";

// One read for the member dashboard. The database function bundles the two
// loan queries, personal statistics and fine summary so the browser does not
// make several overlapping requests on every dashboard visit.
export async function getMyDashboard(semesterId, signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_my_dashboard", { p_semester_id: semesterId ?? null })
    .abortSignal(signal);
  if (error) throw new Error(error.message || "Your dashboard could not be loaded.");
  return data ?? null;
}
