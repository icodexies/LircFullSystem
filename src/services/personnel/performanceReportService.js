// Monthly AI summaries: generation runs in the Edge Function (the AI key
// lives server-side); the list reads the stored rows for one person.
import { getSupabase } from "../auth/authService.js";

async function functionError(error) {
  try {
    const body = await error?.context?.json?.();
    if (body?.error) return new Error(body.error);
  } catch {
    // fall through to the generic message
  }
  return new Error(error?.message || "The summary could not be generated.");
}

export async function generatePerformanceSummary(profileId, month) {
  const client = await getSupabase();
  const { data, error } = await client.functions.invoke(
    "performance-summary",
    { body: { profileId, month } },
  );
  if (error) throw await functionError(error);
  if (data?.error) throw new Error(data.error);
  return data?.report ?? null;
}

// Every stored summary for one person, newest month first (admin only).
export async function listPerformanceReports(profileId) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_performance_reports", {
    p_profile_id: profileId,
  });
  if (error)
    throw new Error(error.message || "The summaries could not be loaded.");
  return data ?? [];
}
