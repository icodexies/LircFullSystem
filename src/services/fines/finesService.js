import { getSupabase } from "../auth/authService.js";

// Fines and the settings store. Reads are role-guarded server-side; the
// fines switch itself can only be changed by admins.
const MISSING_SETUP = ["42883", "PGRST202", "42703", "42P01"];

function finesError(error, fallback) {
  if (MISSING_SETUP.includes(error?.code))
    return new Error(
      "Fines need their database setup first. Apply the fines migration.",
    );
  return new Error(error?.message || fallback);
}

// All settings (currently just "fines"). Library operators only.
//
// The values change only when an admin saves the Settings page, so a short
// shared cache avoids a fresh RPC every time a borrow dialog opens. Errors and
// aborts are never cached; saving invalidates it for everyone.
const SETTINGS_TTL_MS = 60_000;
let settingsCache = null;
let settingsCachedAt = 0;
let settingsPending = null;

export function clearSettingsCache() {
  settingsCache = null;
  settingsCachedAt = 0;
  settingsPending = null;
}

export async function getSettings(signal, { fresh = false } = {}) {
  if (
    !fresh &&
    settingsCache &&
    Date.now() - settingsCachedAt < SETTINGS_TTL_MS
  ) {
    return settingsCache;
  }
  if (settingsPending) return settingsPending;

  const request = (async () => {
    const client = await getSupabase();
    const { data, error } = await client
      .rpc("lirc_settings_get")
      .abortSignal(signal);
    if (error) throw finesError(error, "The settings could not be loaded.");
    settingsCache = data ?? {};
    settingsCachedAt = Date.now();
    return settingsCache;
  })();

  settingsPending = request;
  try {
    return await request;
  } finally {
    if (settingsPending === request) settingsPending = null;
  }
}

// Admins switch the fines on/off and set the daily rate.
export async function setFinesSetting(enabled, ratePerDay) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_settings_set_fines", {
    p_enabled: enabled,
    p_rate_per_day: ratePerDay,
  });
  if (error) throw finesError(error, "The fines setting could not be saved.");
  clearSettingsCache();
  return data;
}

// One member's fines: settled rows, unpaid total, and what is accruing now.
export async function getMemberFines(profileId, signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_member_fines", { p_profile_id: profileId })
    .abortSignal(signal);
  if (error) throw finesError(error, "The member's fines could not be loaded.");
  return data;
}

// The signed-in member's own balance (dashboard card).
export async function getMyFines(signal) {
  const client = await getSupabase();
  const { data, error } = await client
    .rpc("lirc_my_fines")
    .abortSignal(signal);
  if (error) throw finesError(error, "The fines could not be loaded.");
  return data ?? { enabled: false, unpaid_total: 0, unpaid_count: 0 };
}

// Mark a copy lost: closes its open loan and charges the borrower (only
// while the fines setting is on).
export async function flagCopyLost(accessionId, amount, note) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_flag_copy_lost", {
    p_accession_id: accessionId,
    p_amount: amount,
    p_note: note || null,
  });
  if (error) throw finesError(error, "The copy could not be marked lost.");
  return data;
}

// Settle a fine: "paid" or "waived".
export async function settleFine(fineId, action, note) {
  const client = await getSupabase();
  const { data, error } = await client.rpc("lirc_fine_settle", {
    p_fine_id: fineId,
    p_action: action,
    p_note: note || null,
  });
  if (error) throw finesError(error, "The fine could not be settled.");
  return data;
}
