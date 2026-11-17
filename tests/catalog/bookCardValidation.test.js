import test from "node:test";
import assert from "node:assert/strict";
import { findBookCardIssues } from "../../src/services/catalog/bookCardValidation.js";

const complete = {
  id: 1,
  book_name: "Fundamentals of Programming",
  author: "Mir Shehzad Ahmad",
  call_number: "005.13 Ah286f 2024",
  isbn: "9780000000001",
  publisher: "Sample Publisher",
  publish_year: 2024,
  section: { name: "Computer Science" },
};

test("a complete card produces no issues", () => {
  assert.deepEqual(findBookCardIssues([complete]), []);
});

test("missing card fields are listed by their card labels", () => {
  const issues = findBookCardIssues([
    {
      ...complete,
      id: 2,
      book_name: "Incomplete Book",
      author: "",
      call_number: null,
      isbn: "   ",
      publisher: undefined,
      publish_year: null,
      section: null,
      format: null,
    },
  ]);

  assert.equal(issues.length, 1);
  assert.deepEqual(issues[0].missing, [
    "Author",
    "Call number",
    "ISBN",
    "Publisher",
    "Publication year",
    "Subject",
  ]);
});

test("format is accepted as the subject fallback", () => {
  const issues = findBookCardIssues([
    {
      ...complete,
      section: null,
      format: { name: "E-book" },
    },
  ]);
  assert.deepEqual(issues, []);
});
