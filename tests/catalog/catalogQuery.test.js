import test from "node:test";
import assert from "node:assert/strict";
import {
  containsText,
  getPageRange,
  applyCatalogFilters,
  INITIAL_CATALOG_QUERY,
} from "../../src/services/catalog/catalogQuery.js";
import {
  buildBookUpdate,
  getBookImageUrl,
} from "../../src/services/catalog/bookValidation.js";

function requestSpy() {
  const calls = [];
  return {
    calls,
    ilike(...args) {
      calls.push(["ilike", ...args]);
      return this;
    },
    eq(...args) {
      calls.push(["eq", ...args]);
      return this;
    },
    order(...args) {
      calls.push(["order", ...args]);
      return this;
    },
  };
}

test("pagination requests one extra row and does not overlap rendered pages", () => {
  assert.deepEqual(getPageRange(1, 20), { from: 0, to: 20 });
  assert.deepEqual(getPageRange(2, 20), { from: 20, to: 40 });
  assert.deepEqual(getPageRange(3, 50), { from: 100, to: 150 });
  for (const [page, size] of [
    [0, 20],
    [1.5, 20],
    [1, 1000],
    [Number.MAX_SAFE_INTEGER, 50],
  ]) {
    assert.throws(() => getPageRange(page, size), /Invalid/);
  }
});

test("search wildcards are literal and punctuation never becomes a raw OR filter", () => {
  assert.equal(containsText("  50%_off\\sale  "), "%50\\%\\_off\\\\sale%");
  const request = requestSpy();
  applyCatalogFilters(request, {
    ...INITIAL_CATALOG_QUERY,
    search: 'a,b).title"',
  });
  assert.deepEqual(request.calls[0], ["ilike", "book_name", '%a,b).title"%']);
});

test("filters target database columns and every sort has an ID tie-breaker", () => {
  const request = requestSpy();
  applyCatalogFilters(request, {
    ...INITIAL_CATALOG_QUERY,
    formatId: "2",
    shelfId: "8",
    year: "2024",
    sort: "year",
  });
  assert.ok(
    request.calls.some(
      (call) =>
        call[0] === "eq" && call[1] === "book_format_id" && call[2] === "2",
    ),
  );
  assert.ok(
    request.calls.some(
      (call) => call[0] === "eq" && call[1] === "shelf_id" && call[2] === "8",
    ),
  );
  assert.ok(
    request.calls.some(
      (call) =>
        call[0] === "eq" && call[1] === "publish_year" && call[2] === 2024,
    ),
  );
  assert.deepEqual(request.calls.at(-1), ["order", "id", { ascending: false }]);
});

test("unknown fields, sorts and invalid years are rejected", () => {
  for (const searchBy of ["role", "__proto__", "toString"])
    assert.throws(
      () =>
        applyCatalogFilters(requestSpy(), {
          ...INITIAL_CATALOG_QUERY,
          searchBy,
        }),
      /Invalid/,
    );
  assert.throws(
    () =>
      applyCatalogFilters(requestSpy(), {
        ...INITIAL_CATALOG_QUERY,
        sort: "random",
      }),
    /Invalid/,
  );
  for (const year of ["999", "2101", "2024.5", "oops"])
    assert.throws(
      () =>
        applyCatalogFilters(requestSpy(), { ...INITIAL_CATALOG_QUERY, year }),
      /year/,
    );
});

test("accession search filters related copies with literal text and keeps book ordering", () => {
  const request = requestSpy();
  applyCatalogFilters(request, {
    ...INITIAL_CATALOG_QUERY,
    searchBy: "accession_number",
    search: "  001_%  ",
  });
  assert.deepEqual(request.calls[0], [
    "ilike",
    "matching_copies.accession_number",
    "%001\\_\\%%",
  ]);
  assert.equal(
    request.calls.some((call) => call[1] === "department"),
    false,
  );
  assert.deepEqual(request.calls.at(-1), ["order", "id", { ascending: true }]);
  const blank = requestSpy();
  applyCatalogFilters(blank, {
    ...INITIAL_CATALOG_QUERY,
    searchBy: "accession_number",
  });
  assert.equal(
    blank.calls.some((call) => call[0] === "ilike"),
    false,
  );
});

test("book updates preserve ISBN text, convert blank values and exclude protected fields", () => {
  const update = buildBookUpdate({
    book_name: "  A title  ",
    isbn: "001-020",
    publish_year: "2020",
    shelf_id: "4",
    id: 999,
    user_id: "attacker",
    role: "admin",
    department: "Removed column",
    created_at: "changed",
    updated_at: "changed",
  });
  assert.equal(update.book_name, "A title");
  assert.equal(update.isbn, "001-020");
  assert.equal(update.publish_year, 2020);
  assert.equal(update.author, null);
  for (const field of [
    "id",
    "role",
    "user_id",
    "created_at",
    "updated_at",
    "department",
  ])
    assert.equal(Object.hasOwn(update, field), false);
});

test("invalid edit fields are caught before a database update", () => {
  assert.throws(() => buildBookUpdate({ book_name: " " }), /title/);
  assert.throws(
    () => buildBookUpdate({ book_name: "Book", publish_year: "2101" }),
    /year/,
  );
  assert.throws(
    () => buildBookUpdate({ book_name: "Book", shelf_id: "-2" }),
    /section/,
  );
  assert.throws(() => buildBookUpdate({ book_name: "x".repeat(501) }), /long/);
});

test("unsafe image protocols and unconfigured storage paths use a placeholder", () => {
  assert.equal(getBookImageUrl("javascript:alert(1)"), null);
  assert.equal(getBookImageUrl("//tracker.test/image"), null);
  assert.equal(getBookImageUrl("bucket/cover.jpg"), null);
  assert.equal(
    getBookImageUrl("https://example.test/cover.jpg"),
    "https://example.test/cover.jpg",
  );
  assert.equal(getBookImageUrl("/covers/book.jpg"), "/covers/book.jpg");
});
