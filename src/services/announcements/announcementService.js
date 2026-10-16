import { getSupabase } from "../auth/authService.js";

// The announcement board. The feed is member-visible (the popup carousel);
// every write is admin-only, guarded inside the RPCs.
const MISSING_SETUP = ["42883", "PGRST202", "42703", "42P01"];

function announcementError(error, fallback) {
  if (MISSING_SETUP.includes(error?.code))
    return new Error(
      "Announcements need their database setup first. Apply the announcements migration.",
    );
  return new Error(error?.message || fallback);
}

// Active announcements for the signed-in member (their audience only).
export async function getAnnouncementFeed(signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_announcements_feed")
    .abortSignal(signal);
  if (error) throw announcementError(error, "The announcements could not be loaded.");
  return data ?? [];
}

// Every announcement for the admin page.
export async function getAnnouncementsManage(signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_announcements_manage")
    .abortSignal(signal);
  if (error) throw announcementError(error, "The announcements could not be loaded.");
  return data ?? [];
}

// Create (id null) or update one announcement.
export async function saveAnnouncement({
  id = null,
  title,
  body,
  audience = "all",
  imageUrl = null,
  pinned = false,
  endsOn = null,
  publish = false,
}) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_announcement_save", {
    p_id: id,
    p_title: title,
    p_body: body,
    p_audience: audience,
    p_image_url: imageUrl,
    p_pinned: pinned,
    p_ends_on: endsOn || null,
    p_publish: publish,
  });
  if (error) throw announcementError(error, "The announcement could not be saved.");
  return data;
}

// Publish / unpublish from the list.
export async function setAnnouncementStatus(id, publish) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_announcement_set_status", {
    p_id: id,
    p_publish: publish,
  });
  if (error) throw announcementError(error, "The announcement could not be updated.");
  return data;
}

export async function deleteAnnouncement(id) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_announcement_delete", {
    p_id: id,
  });
  if (error) throw announcementError(error, "The announcement could not be deleted.");
  return data;
}

const IMAGE_BUCKET = "announcement-images";

// Upload a prepared WebP (admin-only policy server-side). New names prevent
// stale caches and never overwrite another admin's image.
export async function uploadAnnouncementImage(blob) {
  if (!blob || blob.type !== "image/webp")
    throw new Error("Prepare a valid image before uploading.");
  const supabase = await getSupabase();
  const path = `${crypto.randomUUID()}.webp`;
  const bucket = supabase.storage.from(IMAGE_BUCKET);
  const { error } = await bucket.upload(path, blob, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error)
    throw new Error(
      "Couldn't upload the image. Check your connection and ask an admin to verify the announcement-images storage setup.",
    );
  return bucket.getPublicUrl(path).data.publicUrl;
}
