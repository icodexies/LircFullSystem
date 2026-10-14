// User performance reads (admin only): the library personnel list and one
// person's summarized statistics. Every number comes from the server.
import { getSupabase } from "../auth/authService.js";

function performanceError(error) {
  return new Error(
    error?.message || "The request failed. Check your connection and try again.",
  );
}

export async function personnelPeople({ signal } = {}) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_personnel_performance_people")
    .abortSignal(signal);
  if (error) throw performanceError(error);
  return data ?? [];
}

export async function personnelPerformance(
  profileId,
  { days = 30, signal } = {},
) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_personnel_performance", {
      p_profile_id: profileId,
      p_days: days,
    })
    .abortSignal(signal);
  if (error) throw performanceError(error);
  return data;
}
