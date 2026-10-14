import test from "node:test";
import assert from "node:assert/strict";
import {
  manilaGreeting,
  manilaLongDate,
} from "../../src/services/dashboard/dashboardRules.js";

test("greeting follows Philippine time of day", () => {
  // 8:00 AM Manila = 00:00 UTC.
  assert.equal(
    manilaGreeting(new Date("2026-10-13T00:00:00Z")),
    "Good morning",
  );
  // 1:00 PM Manila = 05:00 UTC.
  assert.equal(
    manilaGreeting(new Date("2026-10-13T05:00:00Z")),
    "Good afternoon",
  );
  // 8:00 PM Manila = 12:00 UTC.
  assert.equal(
    manilaGreeting(new Date("2026-10-13T12:00:00Z")),
    "Good evening",
  );
  // Midnight Manila = 16:00 UTC the day before.
  assert.equal(
    manilaGreeting(new Date("2026-10-12T16:00:00Z")),
    "Good morning",
  );
});

test("long date is written in Philippine time", () => {
  // 11:30 PM UTC is already the next day in Manila.
  assert.equal(
    manilaLongDate(new Date("2026-10-12T23:30:00Z")),
    "Tuesday, October 13, 2026",
  );
});
