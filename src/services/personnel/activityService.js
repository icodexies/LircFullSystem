// Activity history reads (server-built descriptions, keyset pagination).
import { getSupabase } from "../auth/authService.js";

function activityError(error) {
  return new Error(
    error?.message || "The request failed. Check your connection and try again.",
  );
}

export async function activityFeed({
  scope = "own",
  filters = {},
  before = null,
  pageSize = 20,
  signal,
} = {}) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_activity_feed", {
      p_scope: scope,
      p_filters: filters,
      p_before_occurred_at: before?.occurredAt ?? null,
      p_before_id: before?.id ?? null,
      p_page_size: pageSize,
    })
    .abortSignal(signal);
  if (error) throw activityError(error);
  return data;
}

export async function activityTrace(operationId, { signal } = {}) {
  if (!operationId) throw new Error("An operation id is required.");
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_activity_trace", { p_operation_id: operationId })
    .abortSignal(signal);
  if (error) throw activityError(error);
  return data;
}

// Admin-only full log with numbered pages.
export async function activityLogPage({
  filters = {},
  page = 1,
  pageSize = 25,
  signal,
} = {}) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_activity_log_page", {
      p_filters: filters,
      p_page: page,
      p_page_size: pageSize,
    })
    .abortSignal(signal);
  if (error) throw activityError(error);
  return data;
}

// Counts for the dashboard cards (my actions in the last N days).
export async function myActivitySummary({ days = 30, signal } = {}) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_activity_my_summary", { p_days: days })
    .abortSignal(signal);
  if (error) throw activityError(error);
  return data;
}
