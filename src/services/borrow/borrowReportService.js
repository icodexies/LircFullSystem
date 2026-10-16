import { getSupabase } from "../auth/authService.js";

// The Book Borrow report: filtered loans with totals + a summary, and the
// every-row call the Excel export reads. Library operators only.
const MISSING_SETUP = ["42883", "PGRST202", "42703", "42P01"];

function reportError(error, fallback) {
  if (MISSING_SETUP.includes(error?.code))
    return new Error(
      "The borrow report needs its database setup first. Apply the borrow report migration.",
    );
  return new Error(error?.message || fallback);
}

export async function getBorrowReport({
  filters = {},
  page = 1,
  pageSize = 20,
  signal,
} = {}) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_borrow_report", {
      p_filters: filters,
      p_page: page,
      p_page_size: pageSize,
    })
    .abortSignal(signal);
  if (error) throw reportError(error, "The borrow report could not be loaded.");
  return data;
}

// Every matching loan in one call — the Excel job reads this instead of
// paging through the on-screen report.
export async function getBorrowReportExport(filters, signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_borrow_report_export", { p_filters: filters })
    .abortSignal(signal);
  if (error)
    throw reportError(error, "The borrow report could not be exported.");
  return data?.rows ?? [];
}
