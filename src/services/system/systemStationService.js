import { getSupabase } from "../auth/authService.js";

// The system stations: shared accounts for automated use by students inside
// the library. Borrowing stations record loans (accession + card); the
// attendance station records time in / out. Every call is role-guarded on
// the server; the stations cannot reach any other function.
function stationError(error, fallback) {
  if (["42883", "PGRST202", "42703", "42P01"].includes(error?.code))
    return new Error(
      "The stations need their database setup first. Apply the system stations migration.",
    );
  return new Error(error?.message || fallback);
}

export async function systemBorrow(accession, libraryId) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_system_borrow", {
    p_accession: accession,
    p_library_id: libraryId,
  });
  if (error) throw stationError(error, "The loan could not be recorded.");
  return data;
}

export async function systemBorrowRecent(signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_system_borrow_recent")
    .abortSignal(signal);
  if (error) throw stationError(error, "The recent loans could not be loaded.");
  return data ?? [];
}

export async function systemAttendance(libraryId, purpose) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_system_attendance", {
    p_library_id: libraryId,
    p_purpose: purpose || null,
  });
  if (error) throw stationError(error, "The visit could not be recorded.");
  return data;
}

export async function systemAttendanceRecent(signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_system_attendance_recent")
    .abortSignal(signal);
  if (error) throw stationError(error, "The recent visits could not be loaded.");
  return data ?? [];
}
