import test from "node:test";
import assert from "node:assert/strict";
import {
  newPasswordError,
  MIN_PASSWORD_LENGTH,
} from "../../src/services/auth/passwordRules.js";

test("a valid matching password passes", () => {
  assert.equal(newPasswordError("bagong-password1", "bagong-password1"), "");
});

test("short passwords are rejected with the minimum length", () => {
  assert.match(newPasswordError("short1", "short1"), new RegExp(String(MIN_PASSWORD_LENGTH)));
});

test("mismatched confirmation is rejected", () => {
  assert.match(newPasswordError("longenough1", "longenough2"), /do not match/);
});

test("passwords longer than 72 characters are rejected", () => {
  const long = "x".repeat(73);
  assert.match(newPasswordError(long, long), /72/);
});

test("empty input is rejected", () => {
  assert.match(newPasswordError("", ""), /at least/);
});
