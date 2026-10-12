import { getSupabase } from "../auth/authService.js";
import { ACCESS } from "../../routes/roles.js";
import { MAX_COVER_UPLOAD_BYTES } from "./coverImage.js";

const COVER_BUCKET = "book-covers";

export async function uploadBookCover(bookId, blob, role) {
  if (!ACCESS.books.includes(role))
    throw new Error("Only librarians and admins can upload covers.");
  if (!/^[1-9]\d*$/.test(String(bookId)))
    throw new Error("Invalid book record.");
  if (
    !blob ||
    blob.type !== "image/webp" ||
    !blob.size ||
    blob.size > MAX_COVER_UPLOAD_BYTES
  )
    throw new Error("Prepare a valid cover image before uploading.");
  const supabase = await getSupabase();
  // New names prevent stale caches and never overwrite another editor's image.
  const path = `${bookId}/${crypto.randomUUID()}.webp`;
  const bucket = supabase.storage.from(COVER_BUCKET);
  const { error } = await bucket.upload(path, blob, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error)
    throw new Error(
      "Couldn't upload the cover. Check your connection and ask an admin to verify the book-covers storage setup.",
    );
  return bucket.getPublicUrl(path).data.publicUrl;
}
