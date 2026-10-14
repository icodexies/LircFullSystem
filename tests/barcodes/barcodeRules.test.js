import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeNumberList,
  parseNumbersInput,
  safeFileName,
} from "../../src/services/barcodes/barcodeRules.js";

test("number input splits lines, commas, tabs and semicolons", () => {
  const { numbers, skipped } = parseNumbersInput(
    "2026-001\n2026-002, 2026-003; 2026-004\t2026-005",
  );
  assert.deepEqual(numbers, [
    "2026-001",
    "2026-002",
    "2026-003",
    "2026-004",
    "2026-005",
  ]);
  assert.equal(skipped.length, 0);
});

test("number input ignores blanks and flags repeats", () => {
  const { numbers, skipped } = parseNumbersInput(
    "\n  \n5995\n5995\n  5995  \n",
  );
  assert.deepEqual(numbers, ["5995"]);
  assert.equal(skipped.length, 2);
  assert.match(skipped[0].reason, /Repeated/);
});

test("number input flags parts longer than 120 characters", () => {
  const { numbers, skipped } = parseNumbersInput(`${"9".repeat(121)}\nA-1`);
  assert.deepEqual(numbers, ["A-1"]);
  assert.equal(skipped.length, 1);
  assert.match(skipped[0].reason, /120/);
});

test("space, pipe and bullet separated pastes all split", () => {
  assert.deepEqual(parseNumbersInput("5995 2654 8093").numbers, [
    "5995",
    "2654",
    "8093",
  ]);
  assert.deepEqual(parseNumbersInput("5995|2654|8093").numbers, [
    "5995",
    "2654",
    "8093",
  ]);
  assert.deepEqual(parseNumbersInput("• 5995\n• 2654").numbers, [
    "5995",
    "2654",
  ]);
});

test("hyphens stay inside accession numbers", () => {
  assert.deepEqual(parseNumbersInput("26-0001 26-0002").numbers, [
    "26-0001",
    "26-0002",
  ]);
});

test("normalizeNumberList turns any paste into one per line", () => {
  assert.equal(
    normalizeNumberList("5995  2654,8093; 04\t1753"),
    "5995\n2654\n8093\n04\n1753",
  );
  assert.equal(normalizeNumberList("   \n  "), "");
});

test("file names are safe for downloads", () => {
  assert.equal(
    safeFileName("Barcodes - Oct 13, 2026 2:30 PM"),
    "Barcodes - Oct 13, 2026 2-30 PM",
  );
  assert.equal(safeFileName('A/B:C*D?E"F<G>H|I'), "A-B-C-D-E-F-G-H-I");
  assert.equal(safeFileName("   "), "Barcodes");
  assert.equal(safeFileName(null), "Barcodes");
});
