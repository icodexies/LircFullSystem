import test from "node:test";
import assert from "node:assert/strict";
import {
  buildInventoryStart,
  conditionLabel,
  conditionTone,
  currentInventoryYear,
  defaultInventoryName,
  deriveReviewState,
  mergeRecent,
  normalizeAccession,
  replaceRecent,
  scanFeedback,
} from "../../src/services/inventory/inventoryRules.js";

test("accession input trims and unwraps barcode framing", () => {
  assert.equal(normalizeAccession("  1753  "), "1753");
  assert.equal(normalizeAccession("*1753*"), "1753");
  assert.throws(() => normalizeAccession("   "), /valid accession/);
  assert.throws(() => normalizeAccession("x".repeat(121)), /valid accession/);
});

test("start form trims the name and converts the year", () => {
  assert.deepEqual(buildInventoryStart("  Annual Inventory 2026 ", "2026"), {
    name: "Annual Inventory 2026",
    year: 2026,
  });
  assert.throws(() => buildInventoryStart("   ", 2026), /name/);
  assert.throws(
    () => buildInventoryStart("x".repeat(201), 2026),
    /200 characters/,
  );
  assert.throws(() => buildInventoryStart("Inventory", "20x6"), /1900 and 2100/);
  assert.throws(() => buildInventoryStart("Inventory", 2150), /1900 and 2100/);
});

test("inventory year defaults follow Philippine time", () => {
  // 4:30 PM UTC on New Year's Eve is already 12:30 AM next year in Manila.
  const newYearEve = new Date("2026-12-31T16:30:00Z");
  assert.equal(currentInventoryYear(newYearEve), 2027);
  assert.equal(defaultInventoryName(2026), "Annual Inventory 2026");
});

test("scan feedback matches the three outcomes", () => {
  const saved = scanFeedback(
    {
      result: "saved",
      replaced_missing: false,
      entry: { accession_number: "2026-001", condition: "Good" },
    },
    "2026-001",
  );
  assert.equal(saved.tone, "success");
  assert.equal(saved.message, "2026-001 saved — Good Condition.");
  assert.equal(saved.note, "");

  const replaced = scanFeedback(
    {
      result: "saved",
      replaced_missing: true,
      entry: { accession_number: "2026-002", condition: "Damaged" },
    },
    "2026-002",
  );
  assert.equal(replaced.message, "2026-002 saved — Damaged.");
  assert.match(replaced.note, /marked missing earlier/);

  const already = scanFeedback(
    {
      result: "already",
      entry: {
        accession_number: "2026-003",
        condition: "Damaged",
        recorded_at: "2026-10-13T02:41:00Z",
      },
    },
    "2026-003",
  );
  assert.equal(already.tone, "warning");
  assert.match(already.message, /already scanned/);
  assert.match(already.note, /changes nothing/);

  const missing = scanFeedback({ result: "not_found" }, "9999");
  assert.equal(missing.tone, "error");
  assert.match(missing.message, /not found/);
});

test("recent scans stay newest-first, unique and capped", () => {
  const list = Array.from({ length: 20 }, (_, index) => ({ id: index + 1 }));
  const merged = mergeRecent(list, { id: 5, accession_number: "X" });
  assert.equal(merged.length, 20);
  assert.equal(merged[0].id, 5);
  assert.equal(merged.filter((row) => row.id === 5).length, 1);
  assert.equal(merged[19].id, 20);

  const replaced = replaceRecent(merged, { id: 5, accession_number: "Y" });
  assert.equal(replaced.find((row) => row.id === 5).accession_number, "Y");
  assert.equal(replaced.length, 20);
});

test("review rows show missing, borrowed or not yet checked", () => {
  assert.deepEqual(deriveReviewState({ missing: true, borrowed: false }), {
    label: "Missing",
    tone: "danger",
    canMark: false,
  });
  assert.deepEqual(deriveReviewState({ missing: false, borrowed: true }), {
    label: "Borrowed",
    tone: "muted",
    canMark: false,
  });
  assert.deepEqual(deriveReviewState({ missing: false, borrowed: false }), {
    label: "Not yet checked",
    tone: "neutral",
    canMark: true,
  });
});

test("condition labels and tones cover every value", () => {
  assert.equal(conditionLabel("Good"), "Good Condition");
  assert.equal(conditionLabel("Damaged"), "Damaged");
  assert.equal(conditionLabel("Missing"), "Missing");
  assert.equal(conditionLabel(null), "Not yet checked");
  assert.equal(conditionTone("Good"), "success");
  assert.equal(conditionTone("Damaged"), "warning");
  assert.equal(conditionTone("Missing"), "danger");
  assert.equal(conditionTone(null), "muted");
});
