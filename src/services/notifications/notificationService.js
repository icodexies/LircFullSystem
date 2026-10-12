import { getSupabase } from "../auth/authService.js";

// The header bell reads this: the newest alerts plus the unread count.
export async function getNotificationFeed(signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_notification_feed")
    .abortSignal(signal);
  if (error) throw new Error(error.message || "Couldn't load notifications.");
  return data ?? { unread: 0, items: [] };
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
