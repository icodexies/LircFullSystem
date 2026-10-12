import test from "node:test";
import assert from "node:assert/strict";
import {
  buildNewBook,
  buildAccessions,
  buildCopySavePlan,
  filledCopyCount,
} from "../../src/services/catalog/newBookRules.js";

test("new book payload trims values and converts the year", () => {
  const book = buildNewBook({
    book_name: "  Clean Code  ",
    author: " Robert C. Martin ",
    isbn: "",
    publisher: "Prentice Hall",
    edition: "1st",
    call_number: "QA76.76 .M37",
    publish_year: "2008",
  });
  assert.equal(book.book_name, "Clean Code");
  assert.equal(book.author, "Robert C. Martin");
  assert.equal(book.isbn, "");
  assert.equal(book.publish_year, 2008);
});

test("new book rules reject missing titles, long text and bad years", () => {
  assert.throws(() => buildNewBook({ book_name: "  " }), /title is required/);
  assert.throws(
    () => buildNewBook({ book_name: "x".repeat(501) }),
    /500 characters/,
  );
  assert.throws(
    () => buildNewBook({ book_name: "Book", publish_year: "2101" }),
    /1000 and 2100/,
  );
  assert.throws(
    () => buildNewBook({ book_name: "Book", publish_year: "20x8" }),
    /1000 and 2100/,
  );
});

test("accession rules ignore blank rows and count only filled ones", () => {
  const rows = [
    { accession_number: "2026-001", shelf_id: "3" },
    { accession_number: "", shelf_id: "" },
    { accession_number: "2026-002", shelf_id: "" },
  ];
  const accessions = buildAccessions(rows);
  assert.equal(accessions.length, 2);
  assert.deepEqual(accessions[0], {
    accession_number: "2026-001",
    shelf_id: 3,
  });
  assert.deepEqual(accessions[1], {
    accession_number: "2026-002",
    shelf_id: null,
  });
  assert.equal(filledCopyCount(rows), 2);
});

test("accession rules reject duplicates in the form and empty lists", () => {
  assert.throws(
    () =>
      buildAccessions([
        { accession_number: "2026-001" },
        { accession_number: " 2026-001 " },
      ]),
    /appears twice/,
  );
  assert.throws(
    () => buildAccessions([{ accession_number: "" }]),
    /at least one accession/,
  );
  assert.throws(
    () => buildAccessions([{ accession_number: "x".repeat(121) }]),
    /120 characters/,
  );
});

test("copy save plan detects removals, updates and new copies", () => {
  const plan = buildCopySavePlan(
    [
      {
        id: 10,
        accession_number: "2026-001",
        shelf_id: "3",
        original: { accession_number: "2026-001", shelf_id: "3" },
      },
      // Copy 11 was removed from the list.
      { accession_number: "2026-003", shelf_id: "" },
    ],
    [10, 11],
  );
  assert.deepEqual(plan.deleteIds, [11]);
  assert.equal(plan.updates.length, 0);
  assert.deepEqual(plan.newRows, [
    { accession_number: "2026-003", shelf_id: null },
  ]);
});

test("copy save plan reports edits and refuses no-op saves", () => {
  const changed = buildCopySavePlan(
    [
      {
        id: 5,
        accession_number: "X-1",
        shelf_id: "2",
        original: { accession_number: "X-1", shelf_id: "" },
      },
    ],
    [5],
  );
  assert.deepEqual(changed.updates, [
    { id: 5, accession_number: "X-1", shelf_id: 2 },
  ]);
  assert.throws(
    () =>
      buildCopySavePlan(
        [
          {
            id: 5,
            accession_number: "X-1",
            shelf_id: "",
            original: { accession_number: "X-1", shelf_id: "" },
          },
        ],
        [5],
      ),
    /Nothing changed/,
  );
});

test("copy save plan checks duplicates across saved and new rows", () => {
  assert.throws(
    () =>
      buildCopySavePlan(
        [
          {
            id: 7,
            accession_number: "A-1",
            shelf_id: "",
            original: { accession_number: "A-1", shelf_id: "" },
          },
          { accession_number: "a-1", shelf_id: "" },
        ],
        [7],
      ),
    /appears twice/,
  );
});
