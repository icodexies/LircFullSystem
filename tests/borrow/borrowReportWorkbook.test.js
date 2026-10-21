import test from "node:test";
import assert from "node:assert/strict";
import {
  LOAN_COLUMNS,
  LOAN_WIDTHS,
} from "../../src/services/borrow/borrowReportWorkbook.js";

test("the loans sheet has a Person status column after Role", () => {
  const index = LOAN_COLUMNS.indexOf("Person status");
  assert.ok(index > 0, "Person status column is present");
  assert.equal(LOAN_COLUMNS[index - 1], "Role");
  assert.equal(LOAN_COLUMNS.length, LOAN_WIDTHS.length);
});
