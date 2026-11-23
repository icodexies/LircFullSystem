import { getSupabase } from "../auth/authService.js";

const MISSING_SETUP = ["42883", "PGRST202", "42703", "42P01"];

// The header bell reads this with the defaults; the notifications page asks
// for a page at a time (limit + offset) and gets the total back.
export async function getNotificationFeed({ limit = 20, offset = 0, signal } = {}) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_notification_feed", { p_limit: limit, p_offset: offset })
    .abortSignal(signal);
  if (error) throw new Error(error.message || "Couldn't load notifications.");
  return data ?? { unread: 0, items: [], total: 0, has_more: false };
}

// Lightweight polling for the bell: do not download the feed on every poll.
// Older databases fall back to a one-row feed, which still returns `unread`.
export async function getNotificationUnread(signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_notification_unread")
    .abortSignal(signal);
  if (!error) {
    return data ?? { unread: 0, total: 0, latest_at: null };
  }
  if (!MISSING_SETUP.includes(error.code)) {
    throw new Error(error.message || "Couldn't load notifications.");
  }
  const feed = await getNotificationFeed({ limit: 1, offset: 0, signal });
  return {
    unread: feed.unread ?? 0,
    total: feed.total ?? 0,
    latest_at: feed.items?.[0]?.created_at ?? null,
  };
}

// Mark one or more alerts as read; null marks everything as read.
export async function markNotificationsRead(ids = null) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_notifications_mark_read", {
    p_ids: ids,
  });
  if (error) throw new Error(error.message || "Couldn't update notifications.");
  return data?.unread ?? 0;
}
