import test from "node:test";
import assert from "node:assert/strict";
import { isScannerHotkey } from "../../src/services/attendance/scannerHotkey.js";

const key = (overrides = {}) => ({
  key: "x",
  target: { tagName: "BODY" },
  ...overrides,
});

test("a plain x press is the scanner shortcut", () => {
  assert.equal(isScannerHotkey(key()), true);
  assert.equal(isScannerHotkey(key({ key: "X" })), true);
});

test("x while typing in a field stays normal typing", () => {
  for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) {
    assert.equal(isScannerHotkey(key({ target: { tagName } })), false);
  }
  assert.equal(
    isScannerHotkey(key({ target: { tagName: "DIV", isContentEditable: true } })),
    false,
  );
});

test("modifier combinations and held keys never trigger", () => {
  assert.equal(isScannerHotkey(key({ ctrlKey: true })), false);
  assert.equal(isScannerHotkey(key({ metaKey: true })), false);
  assert.equal(isScannerHotkey(key({ altKey: true })), false);
  assert.equal(isScannerHotkey(key({ repeat: true })), false);
});

test("other keys and missing events never trigger", () => {
  assert.equal(isScannerHotkey(key({ key: "y" })), false);
  assert.equal(isScannerHotkey(key({ key: "Escape" })), false);
  assert.equal(isScannerHotkey(null), false);
});
