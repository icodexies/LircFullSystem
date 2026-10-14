import test from "node:test";
import assert from "node:assert/strict";
import { MEMBER_PAGES, canAccessPage } from "../../src/routes/memberPages.js";

// Expected access is written independently of the page definitions.
const expectedPages = {
  student: ["dashboard", "opac", "path-finder", "statistics"],
  faculty: ["dashboard", "opac", "path-finder", "statistics"],
  non_teaching_personnel: ["dashboard", "opac", "path-finder", "statistics"],
  staff: [
    "dashboard",
    "opac",
    "path-finder",
    "statistics",
    "users",
    "attendance",
    "barcode-generator",
    "book-borrow",
    "inventory",
  ],
  librarian: [
    "dashboard",
    "opac",
    "path-finder",
    "statistics",
    "users",
    "attendance",
    "enrollments",
    "academic-periods",
    "barcode-generator",
    "book-borrow",
    "inventory",
    "adding-books",
  ],
  admin: [
    "dashboard",
    "opac",
    "path-finder",
    "statistics",
    "users",
    "user-logs",
    "user-performance",
    "attendance",
    "enrollments",
    "academic-periods",
    "barcode-generator",
    "book-borrow",
    "inventory",
    "adding-books",
  ],
};

for (const [role, expected] of Object.entries(expectedPages)) {
  test(`${role} can access only their assigned pages`, () => {
    for (const page of MEMBER_PAGES) {
      assert.equal(
        canAccessPage(page, role),
        expected.includes(page.id),
        `${role}: ${page.label}`,
      );
    }
  });
}

test("missing and unknown roles cannot access any member page", () => {
  for (const role of [null, undefined, "", "unknown", "ADMIN"]) {
    for (const page of MEMBER_PAGES)
      assert.equal(canAccessPage(page, role), false);
  }
});

test("all fourteen pages have unique route paths and IDs", () => {
  assert.equal(MEMBER_PAGES.length, 14);
  assert.equal(new Set(MEMBER_PAGES.map((page) => page.id)).size, 14);
  assert.equal(new Set(MEMBER_PAGES.map((page) => page.path)).size, 14);
});
