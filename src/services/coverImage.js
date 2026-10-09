export const MAX_COVER_INPUT_BYTES = 10 * 1024 * 1024;
export const MAX_COVER_UPLOAD_BYTES = 512 * 1024;
const COVER_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validateCoverFile(file) {
  if (!file || !COVER_TYPES.includes(file.type))
    throw new Error("Choose a JPG, PNG or WebP image.");
  if (!file.size || file.size > MAX_COVER_INPUT_BYTES)
    throw new Error("Choose an image smaller than 10 MB.");
}

// Decode only when an editor chooses a file, then upload a small, static cover.
export async function prepareCoverImage(file) {
  validateCoverFile(file);
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(
      "This image could not be opened. Try another JPG, PNG or WebP.",
    );
  }
  try {
    if (
      !bitmap.width ||
      !bitmap.height ||
      bitmap.width * bitmap.height > 32_000_000
    )
      throw new Error(
        "This image is too large. Choose a photo under 32 megapixels.",
      );
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not prepare this image.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.8),
    );
    if (
      !blob ||
      blob.type !== "image/webp" ||
      blob.size > MAX_COVER_UPLOAD_BYTES
    )
      throw new Error(
        "The cover is still too large. Choose a smaller or simpler image.",
      );
    return blob;
  } finally {
    bitmap.close();
  }
}
