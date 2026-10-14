import { getSupabase } from "../auth/authService.js";

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

// Mark one or more alerts as read; null marks everything as read.
export async function markNotificationsRead(ids = null) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_notifications_mark_read", {
    p_ids: ids,
  });
  if (error) throw new Error(error.message || "Couldn't update notifications.");
  return data?.unread ?? 0;
}
