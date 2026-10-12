import { getSupabase } from "../auth/authService.js";
import { applyCatalogFilters, getPageRange } from "./catalogQuery.js";
import { buildBookUpdate } from "./bookValidation.js";
import { ACCESS } from "../../routes/roles.js";

const LIST_FIELDS =
  "id,book_name,author,isbn,publish_year,edition,book_image,call_number,shelf_id,book_format_id,updated_at,section:shelves(id,name),format:book_formats(id,name)";
const DETAIL_FIELDS = `${LIST_FIELDS},publisher,place_of_publication,barcode_tag_number,asset_number,created_at`;
const COPY_PAGE_SIZE = 10;

function catalogReadError(error) {
  if (["PGRST205", "PGRST200", "42703", "42P01"].includes(error.code)) {
    return new Error(
      "The library catalog needs database setup before it can be used. Please contact a librarian.",
    );
  }
  if (error.code === "42501")
    return new Error(
      "Your account cannot read the catalog. Please contact a librarian.",
    );
  return new Error(
    "Couldn't load the catalog. Check your connection and try again.",
  );
}

export async function getBooks(query, signal) {
  const supabase = await getSupabase();
  const { from, to } = getPageRange(query.page, query.pageSize);
  // Empty inner embedding filters books by matching copies without downloading copies.
  const fields =
    query.searchBy === "accession_number" && query.search.trim()
      ? `${LIST_FIELDS},matching_copies:book_accession_numbers!inner()`
      : LIST_FIELDS;
  const request = applyCatalogFilters(
    supabase.from("books").select(fields),
    query,
  );
  const { data, error } = await request.range(from, to).abortSignal(signal);
  if (error) throw catalogReadError(error);
  const rows = data ?? [];
  return {
    books: rows.slice(0, query.pageSize),
    hasNext: rows.length > query.pageSize,
  };
}

async function getLookupRows(supabase, table, signal) {
  const rows = [];
  const batchSize = 100;
  // Only the small lookup tables are collected, in bounded batches. Never books.
  for (let from = 0; ; from += batchSize) {
    const { data, error } = await supabase
      .from(table)
      .select("id,name")
      .order("name")
      .order("id")
      .range(from, from + batchSize - 1)
      .abortSignal(signal);
    if (error) throw catalogReadError(error);
    rows.push(...(data ?? []));
    if (!data || data.length < batchSize) return rows;
  }
}

export async function getCatalogLookups(signal) {
  const supabase = await getSupabase();
  const [formats, shelves] = await Promise.all([
    getLookupRows(supabase, "book_formats", signal),
    getLookupRows(supabase, "shelves", signal),
  ]);
  return { formats, shelves };
}

export async function getBook(id, signal) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("books")
    .select(DETAIL_FIELDS)
    .eq("id", id)
    .single()
    .abortSignal(signal);
  if (error) throw catalogReadError(error);
  return data;
}

export async function getBookCopies(bookId, page, signal) {
  const supabase = await getSupabase();
  const { from, to } = getPageRange(page, COPY_PAGE_SIZE);
  const { data, error } = await supabase
    .from("book_accession_numbers")
    .select("id,accession_number,status")
    .eq("book_id", bookId)
    .order("accession_number")
    .order("id")
    .range(from, to)
    .abortSignal(signal);
  if (error) throw catalogReadError(error);
  const rows = data ?? [];
  return {
    copies: rows.slice(0, COPY_PAGE_SIZE),
    hasNext: rows.length > COPY_PAGE_SIZE,
  };
}

export async function updateBook(book, form, role) {
  // UI safeguard. The database RLS policy is the actual authority.
  if (!ACCESS.books.includes(role))
    throw new Error("Only librarians and admins can edit books.");
  if (!book.updated_at)
    throw new Error(
      "The book has no updated_at value. Apply the catalog timestamp schema first.",
    );
  const payload = buildBookUpdate(form);
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("books")
    .update(payload)
    .eq("id", book.id)
    .eq("updated_at", book.updated_at)
    .select("id,updated_at")
    .maybeSingle();
  if (error) {
    if (error.code === "42501")
      throw new Error("Your account is not allowed to update this book.");
    if (error.code === "23503")
      throw new Error(
        "The section or format changed. Refresh the catalog and choose again.",
      );
    throw new Error(
      "Couldn't save this book. Check your connection and try again.",
    );
  }
  if (!data)
    throw new Error(
      "This book changed or your edit permission changed. Close this window, reload the page, and try again.",
    );
  return data;
}
