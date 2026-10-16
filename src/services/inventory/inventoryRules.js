// Pure rules for the Inventory pages: labels, small list helpers and the
// feedback text shown after each scan. The database repeats every rule
// (lirc_inventory_* functions), so messages stay consistent.
import { displayTime, manilaDate } from "../attendance/attendanceRules.js";

export const CONDITIONS = [
  { value: "Good", label: "Good Condition" },
  { value: "Damaged", label: "Damaged" },
  { value: "Lost", label: "Lost" },
];
export const DEFAULT_CONDITION = "Good";
export const RECENT_LIMIT = 20;

export function conditionLabel(value) {
  if (value === "Good") return "Good Condition";
  if (value === "Damaged") return "Damaged";
  if (value === "Lost") return "Lost";
  if (value === "Missing") return "Missing";
  return "Not yet checked";
}

export function conditionTone(value) {
  if (value === "Good") return "success";
  if (value === "Damaged") return "warning";
  if (value === "Lost") return "danger";
  if (value === "Missing") return "danger";
  return "muted";
}

// Scan input normalization: trims and unwraps barcode *…* framing.
export function normalizeAccession(value) {
  let accession = String(value ?? "").trim();
  if (
    accession.startsWith("*") &&
    accession.endsWith("*") &&
    accession.length > 2
  )
    accession = accession.slice(1, -1);
  if (!accession || accession.length > 120)
    throw new Error("Enter a valid accession number.");
  return accession;
}

export function currentInventoryYear(now = new Date()) {
  return Number(manilaDate(now).slice(0, 4));
}

export function defaultInventoryName(year) {
  return `Annual Inventory ${year}`;
}

export function buildInventoryStart(name, year) {
  const cleanName = String(name ?? "").trim();
  if (!cleanName) throw new Error("Give the inventory a name.");
  if (cleanName.length > 200)
    throw new Error("Inventory name must be 200 characters or fewer.");
  const cleanYear = Number(year);
  if (!Number.isInteger(cleanYear) || cleanYear < 1900 || cleanYear > 2100)
    throw new Error("Enter a year between 1900 and 2100.");
  return { name: cleanName, year: cleanYear };
}

// The feedback banner for one scan result.
export function scanFeedback(result, accession) {
  if (!result || result.result === "not_found")
    return {
      tone: "error",
      message: `${accession} was not found in the catalog.`,
      note: "Check the number, or add the book first in Adding Books.",
    };
  if (result.result === "already") {
    const entry = result.entry ?? {};
    return {
      tone: "warning",
      message: `${entry.accession_number || accession} was already scanned.`,
      note: `Recorded ${displayTime(entry.recorded_at)} as ${conditionLabel(entry.condition)}. Scanning it again changes nothing.`,
    };
  }
  const entry = result.entry ?? {};
  return {
    tone: "success",
    message: `${entry.accession_number || accession} saved — ${conditionLabel(entry.condition)}.`,
    note: result.replaced_missing
      ? "This copy was marked missing earlier. The scan replaced that record."
      : "",
  };
}

// Keep the recent list newest-first and capped, without duplicates.
export function mergeRecent(list, entry) {
  return [entry, ...(list ?? []).filter((row) => row.id !== entry.id)].slice(
    0,
    RECENT_LIMIT,
  );
}

export function replaceRecent(list, entry) {
  return (list ?? []).map((row) => (row.id === entry.id ? entry : row));
}

// What one review-list row shows.
export function deriveReviewState(row) {
  if (row.missing) return { label: "Missing", tone: "danger", canMark: false };
  if (row.borrowed) return { label: "Borrowed", tone: "muted", canMark: false };
  return { label: "Not yet checked", tone: "neutral", canMark: true };
}
