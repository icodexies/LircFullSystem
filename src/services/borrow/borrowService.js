import { getSupabase } from "../auth/authService.js";

export function borrowError(error) {
  if (error?.code === "23505")
    return new Error(
      "This copy was just borrowed by someone else. Refresh and choose another copy.",
    );
  if (["42883", "PGRST202", "42703", "42P01"].includes(error?.code))
    return new Error(
      "Borrowing needs its database setup first. Apply the book loans migration.",
    );
  return new Error(
    error?.message || "The request failed. Check your connection and try again.",
  );
}

// Member + validation + overdue summary before lending (by card).
export async function borrowPreview(card) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_borrow_preview", {
    p_library_id: card,
  });
  if (error) throw borrowError(error);
  return data;
}

// Record a loan for one accession number. `returned` adds an old record that
// is already returned.
export async function borrowBook({
  accession,
  profileId,
  start,
  due,
  returned = null,
}) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_borrow_book", {
    p_accession: accession,
    p_profile_id: profileId,
    p_start: start,
    p_due: due,
    p_returned_at: returned,
  });
  if (error) throw borrowError(error);
  return data;
}

// Mark one loan returned by the borrower themselves. The card must match the
// loan's borrower; the database rejects any other card. Defaults to now.
export async function returnLoan(loanId, libraryId, returnedAt = null) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_return_loan", {
    p_loan_id: loanId,
    p_library_id: libraryId,
    p_returned_at: returnedAt,
  });
  if (error) throw borrowError(error);
  return data;
}

// All loans of one book (who borrowed it, current and past).
export async function getBookLoans(bookId, signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_book_loans", { p_book_id: bookId })
    .abortSignal(signal);
  if (error) throw borrowError(error);
  return data?.loans ?? [];
}

// All loans of one member (books borrowed by a person).
export async function getMemberLoans(profileId, signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_member_loans", { p_profile_id: profileId })
    .abortSignal(signal);
  if (error) throw borrowError(error);
  return data?.loans ?? [];
}

// The caller's own circulation records (My Borrowing): one page of their
// loans — still out, overdue or returned — with a status filter, search and
// all-time totals. The server only ever returns the caller's own rows.
export async function getMyLoans({
  status = "all",
  search = "",
  page = 1,
  pageSize = 20,
  signal,
} = {}) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_my_loans", {
      p_status: status,
      p_search: search,
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
    })
    .abortSignal(signal);
  if (error) throw borrowError(error);
  return data;
}

// Find members by name or library card.
export async function findMembers(search, signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_member_lookup", { p_search: search })
    .abortSignal(signal);
  if (error) throw borrowError(error);
  return data?.members ?? [];
}

// Borrow records for the Book Borrow tabs: one page of loans (borrowed,
// overdue or returned) with server-side totals, pages and tab counts.
export async function getLoanRecords({
  scope,
  filters = {},
  page = 1,
  pageSize = 20,
  signal,
} = {}) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_loan_records", {
      p_scope: scope,
      p_filters: filters,
      p_page: page,
      p_page_size: pageSize,
    })
    .abortSignal(signal);
  if (error) throw borrowError(error);
  return data;
}
