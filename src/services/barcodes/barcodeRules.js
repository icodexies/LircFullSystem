// Pure rules for the Barcode Generator page. The database repeats every rule
// (lirc_barcode_* functions), so messages stay consistent.
export const MAX_NUMBERS_PER_ADD = 200;

// Separators staff may use when pasting numbers: any whitespace (spaces,
// tabs, newlines), commas, semicolons, pipes or bullet points. A dash is NOT
// a separator because accession numbers contain them (for example 26-0001).
export const NUMBER_SEPARATORS = /[\s,;|•]+/;

// Turn any pasted text into the one-number-per-line list the box shows.
export function normalizeNumberList(text) {
  return String(text ?? "")
    .split(NUMBER_SEPARATORS)
    .map((value) => value.trim())
    .filter((value) => value !== "")
    .join("\n");
}

// Split typed/pasted text into accession numbers. Blank parts are ignored;
// repeats and very long parts are reported instead of added.
export function parseNumbersInput(text) {
  const numbers = [];
  const skipped = [];
  const seen = new Set();
  for (const part of String(text ?? "").split(NUMBER_SEPARATORS)) {
    const value = part.trim();
    if (value === "") continue;
    if (value.length > 120) {
      skipped.push({
        value: value.slice(0, 40),
        reason: "Longer than 120 characters",
      });
      continue;
    }
    const key = value.toLowerCase();
    if (seen.has(key)) {
      skipped.push({ value, reason: "Repeated in the list" });
      continue;
    }
    seen.add(key);
    numbers.push(value);
  }
  return { numbers, skipped };
}

// A file name that is safe for every operating system.
export function safeFileName(name) {
  const clean = String(name ?? "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return clean.slice(0, 120) || "Barcodes";
}
