import test from "node:test";
import assert from "node:assert/strict";
import { MEMBER_PAGES, canAccessPage } from "../../src/routes/memberPages.js";

// Expected access is written independently of the page definitions.
const expectedPages = {
  student: [
    "dashboard",
    "opac",
    "path-finder",
    "statistics",
    "my-borrowing",
    "announcements",
  ],
  faculty: [
    "dashboard",
    "opac",
    "path-finder",
    "statistics",
    "my-borrowing",
    "announcements",
  ],
  non_teaching_personnel: [
    "dashboard",
    "opac",
    "path-finder",
    "statistics",
    "my-borrowing",
    "announcements",
  ],
  staff: [
    "dashboard",
    "opac",
    "path-finder",
    "statistics",
    "my-borrowing",
    "announcements",
    "users",
    "attendance",
    "barcode-generator",
    "book-borrow",
    "inventory",
    "adding-books",
  ],
  librarian: [
    "dashboard",
    "opac",
    "path-finder",
    "statistics",
    "announcements",
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
    "announcements",
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

test("system station accounts cannot access any member page", () => {
  for (const role of ["system_borrow", "system_attendance"]) {
    for (const page of MEMBER_PAGES)
      assert.equal(canAccessPage(page, role), false);
  }
});

test("all sixteen pages have unique route paths and IDs", () => {
  assert.equal(MEMBER_PAGES.length, 16);
  assert.equal(new Set(MEMBER_PAGES.map((page) => page.id)).size, 16);
  assert.equal(new Set(MEMBER_PAGES.map((page) => page.path)).size, 16);
});
