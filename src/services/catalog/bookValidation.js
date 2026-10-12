const TEXT_LIMITS = {
  book_name: 500,
  author: 1000,
  isbn: 100,
  book_image: 2000,
  call_number: 200,
  edition: 200,
  publisher: 500,
  place_of_publication: 500,
  barcode_tag_number: 200,
  asset_number: 200,
};

export function buildBookUpdate(form) {
  const result = {};
  for (const [field, limit] of Object.entries(TEXT_LIMITS)) {
    const value = String(form[field] ?? "").trim();
    if (value.length > limit)
      throw new Error(`${field.replaceAll("_", " ")} is too long.`);
    result[field] = value || null;
  }
  if (!result.book_name) throw new Error("A book title is required.");
  for (const field of ["shelf_id", "book_format_id"]) {
    const value = String(form[field] ?? "").trim();
    if (value && !/^[1-9]\d*$/.test(value))
      throw new Error("Choose a valid section and material format.");
    result[field] = value || null;
  }
  const year = String(form.publish_year ?? "").trim();
  if (
    year &&
    (!/^\d{4}$/.test(year) || Number(year) < 1000 || Number(year) > 2100)
  ) {
    throw new Error("Publication year must be between 1000 and 2100.");
  }
  result.publish_year = year ? Number(year) : null;
  // IDs, timestamps and copy records never come from this form.
  return result;
}

export function getBookImageUrl(value) {
  const src = String(value ?? "").trim();
  if (
    /^https?:\/\//i.test(src) ||
    (src.startsWith("/") && !src.startsWith("//"))
  )
    return src;
  return null;
}
