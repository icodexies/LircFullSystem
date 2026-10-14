// Sign-in history: audit ledger when enabled, session records as fallback.
import { getSupabase } from "../auth/authService.js";

export async function signInActivity({
  scope = "own",
  pageSize = 10,
  offset = 0,
  signal,
} = {}) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_sign_in_activity", {
      p_scope: scope,
      p_page_size: pageSize,
      p_offset: offset,
    })
    .abortSignal(signal);
  if (error)
    throw new Error(
      error?.message ||
        "The request failed. Check your connection and try again.",
    );
  return data;
}
