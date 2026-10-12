import test from "node:test";
import assert from "node:assert/strict";
import {
  manilaInputValue,
  manilaInputToIso,
  addDaysInput,
  loanDateError,
  returnDateError,
} from "../../src/services/borrow/loanRules.js";

test("Manila datetime inputs convert to the correct UTC moment", () => {
  assert.equal(manilaInputToIso("2026-10-12T14:30"), "2026-10-12T06:30:00.000Z");
  assert.equal(manilaInputToIso("2026-01-02T00:05"), "2026-01-01T16:05:00.000Z");
});

test("impossible or malformed datetimes are rejected", () => {
  assert.equal(manilaInputToIso("2026-02-30T10:00"), null);
  assert.equal(manilaInputToIso("2026-10-12T25:00"), null);
  assert.equal(manilaInputToIso("12/10/2026"), null);
  assert.equal(manilaInputToIso(""), null);
});

test("adding days keeps the Manila clock time", () => {
  assert.equal(addDaysInput("2026-10-12T08:00", 7), "2026-10-19T08:00");
  assert.equal(addDaysInput("nope", 7), "");
});

test("return date rules mirror the database checks", () => {
  const today = manilaInputValue();
  const borrowed = addDaysInput(today, -10);
  assert.equal(returnDateError({ borrowedAt: borrowed, returned: today }), "");
  assert.match(
    returnDateError({ borrowedAt: today, returned: addDaysInput(today, -1) }),
    /before it was borrowed/,
  );
  assert.match(
    returnDateError({ borrowedAt: borrowed, returned: addDaysInput(today, 5) }),
    /future/,
  );
  assert.match(returnDateError({ borrowedAt: borrowed, returned: "nope" }), /valid/);
});

test("loan date rules mirror the database checks", () => {
  const today = manilaInputValue();
  const nextWeek = addDaysInput(today, 7);
  assert.equal(loanDateError({ start: today, due: nextWeek }), "");
  assert.equal(
    loanDateError({ start: today, due: nextWeek, returned: today }),
    "",
  );
  assert.match(
    loanDateError({ start: today, due: addDaysInput(today, -1) }),
    /after the start/,
  );
  assert.match(
    loanDateError({ start: today, due: addDaysInput(today, 400) }),
    /one year/,
  );
  assert.match(
    loanDateError({ start: addDaysInput(today, 3), due: nextWeek }),
    /future/,
  );
  assert.match(
    loanDateError({
      start: today,
      due: nextWeek,
      returned: addDaysInput(today, -2),
    }),
    /before the start/,
  );
  assert.match(
    loanDateError({ start: "2010-01-01T08:00", due: nextWeek }),
    /invalid/,
  );
  assert.match(loanDateError({ start: "", due: nextWeek }), /Provide/);
});
