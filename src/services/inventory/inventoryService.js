// Inventory RPC wrappers. The database (lirc_inventory_* functions) holds the
// real rules; this file only shapes requests and friendly error messages.
import { getSupabase } from "../auth/authService.js";

export function inventoryError(error) {
  if (["42883", "PGRST202", "42703", "42P01", "PGRST205"].includes(error?.code))
    return new Error(
      "Inventory needs its database setup first. Apply the inventory migration.",
    );
  return new Error(
    error?.message || "The request failed. Check your connection and try again.",
  );
}

// The open inventory (or none), with live counts and the recent scans.
export async function getInventoryState(signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_inventory_state")
    .abortSignal(signal);
  if (error) throw inventoryError(error);
  return data;
}

export async function startInventory(name, year) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_inventory_start", {
    p_name: name,
    p_year: year,
  });
  if (error) throw inventoryError(error);
  return data;
}

// Set the open inventory aside without losing anything.
export async function pauseInventory(sessionId) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_inventory_pause", {
    p_session_id: sessionId,
  });
  if (error) throw inventoryError(error);
  return data;
}

// Make a paused inventory the open one again.
export async function resumeInventory(sessionId) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_inventory_resume", {
    p_session_id: sessionId,
  });
  if (error) throw inventoryError(error);
  return data;
}

// One scan. Returns { result: "saved" | "already" | "not_found", ... }.
export async function scanAccession(sessionId, accession, condition) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_inventory_scan", {
    p_session_id: sessionId,
    p_accession: accession,
    p_condition: condition,
  });
  if (error) throw inventoryError(error);
  return data;
}

export async function updateScanCondition(entryId, condition) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_inventory_update_entry", {
    p_entry_id: entryId,
    p_condition: condition,
  });
  if (error) throw inventoryError(error);
  return data;
}

export async function setCopyMissing(sessionId, accessionId, missing) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_inventory_set_missing", {
    p_session_id: sessionId,
    p_accession_id: accessionId,
    p_missing: missing,
  });
  if (error) throw inventoryError(error);
  return data;
}

// Copies with no scan yet in this inventory (review list), one page at a time.
export async function getUnscanned(
  sessionId,
  { search = "", page = 1, pageSize = 50 } = {},
  signal,
) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_inventory_unscanned", {
      p_session_id: sessionId,
      p_search: search,
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
    })
    .abortSignal(signal);
  if (error) throw inventoryError(error);
  return data;
}

export async function finishInventory(sessionId) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_inventory_finish", {
    p_session_id: sessionId,
  });
  if (error) throw inventoryError(error);
  return data;
}

export async function getInventoryHistory(signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_inventory_history", { p_limit: 50 })
    .abortSignal(signal);
  if (error) throw inventoryError(error);
  return data?.sessions ?? [];
}

export async function getInventoryEntries(
  sessionId,
  { page = 1, pageSize = 50 } = {},
  signal,
) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_inventory_entries", {
      p_session_id: sessionId,
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
    })
    .abortSignal(signal);
  if (error) throw inventoryError(error);
  return data;
}
