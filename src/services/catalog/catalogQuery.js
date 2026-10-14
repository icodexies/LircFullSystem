export const SEARCH_FIELDS = {
  book_name: "Title",
  author: "Author",
  isbn: "ISBN",
  call_number: "Call number",
  accession_number: "Accession number",
};

export const PAGE_SIZES = [10, 20, 50];
export const INITIAL_CATALOG_QUERY = {
  page: 1,
  pageSize: 20,
  search: "",
  searchBy: "book_name",
  formatId: "",
  shelfId: "",
  year: "",
  sort: "title",
};

// Treat %, _ and backslashes as text, rather than search wildcards.
export function containsText(value) {
  return `%${String(value)
    .trim()
    .slice(0, 120)
    .replace(/[\\%_]/g, "\\$&")}%`;
}

// Split a search into words so every word must appear somewhere in the chosen
// field (any order) — the same rule as the member, report and inventory
// searches.
export function searchWords(value) {
  return String(value ?? "")
    .trim()
    .slice(0, 120)
    .split(/\s+/)
    .filter((word) => word !== "")
    .map((word) => `%${word.replace(/[\\%_]/g, "\\$&")}%`);
}

export function getPageRange(page, pageSize) {
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !PAGE_SIZES.includes(pageSize)
  ) {
    throw new Error("Invalid catalog page.");
  }
  const from = (page - 1) * pageSize;
  if (!Number.isSafeInteger(from + pageSize))
    throw new Error("Invalid catalog page.");
  // Supabase ranges are inclusive: the extra row tells us if there is a next page.
  return { from, to: from + pageSize };
}

export function applyCatalogFilters(request, query) {
  if (!Object.hasOwn(SEARCH_FIELDS, query.searchBy))
    throw new Error("Invalid search field.");
  if (query.search.trim()) {
    const column =
      query.searchBy === "accession_number"
        ? "matching_copies.accession_number"
        : query.searchBy;
    // Every word must appear in the chosen field (any order).
    for (const pattern of searchWords(query.search)) {
      request = request.ilike(column, pattern);
    }
  }
  if (query.formatId) request = request.eq("book_format_id", query.formatId);
  if (query.shelfId) request = request.eq("shelf_id", query.shelfId);
  if (query.year) {
    if (
      !/^\d{4}$/.test(String(query.year)) ||
      Number(query.year) < 1000 ||
      Number(query.year) > 2100
    ) {
      throw new Error("Enter a publication year between 1000 and 2100.");
    }
    request = request.eq("publish_year", Number(query.year));
  }
  if (query.sort === "title")
    request = request.order("book_name", { ascending: true });
  else if (query.sort === "newest")
    request = request.order("created_at", { ascending: false });
  else if (query.sort === "year")
    request = request.order("publish_year", {
      ascending: false,
      nullsFirst: false,
    });
  else throw new Error("Invalid catalog sort.");
  return request.order("id", { ascending: query.sort === "title" });
}
