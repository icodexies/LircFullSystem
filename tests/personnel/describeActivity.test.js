import test from "node:test";
import assert from "node:assert/strict";
import {
  activityLink,
  sourceLabel,
  actorKindLabel,
  filterToParams,
} from "../../src/services/personnel/describeActivity.js";

test("records link to the page that manages them", () => {
  assert.equal(activityLink({ entity_type: "books" }), "/opac");
  assert.equal(activityLink({ entity_type: "inventory_entries" }), "/inventory");
  assert.equal(activityLink({ entity_type: "book_loans" }), "/book-borrow");
  assert.equal(activityLink({ entity_type: "usersData" }), "/users");
  assert.equal(activityLink({ entity_type: "barcode_templates" }), "/barcode-generator");
  assert.equal(activityLink({ entity_type: "goal_items" }), null);
  assert.equal(activityLink(null), null);
});

test("source and actor labels are plain language", () => {
  assert.equal(sourceLabel("app"), "In the app");
  assert.equal(sourceLabel("auto"), "Automatic follow-up");
  assert.equal(sourceLabel("direct_table"), "Direct table edit");
  assert.equal(sourceLabel(undefined), "Unknown");
  assert.equal(actorKindLabel("user"), "Person");
  assert.equal(actorKindLabel("system"), "System");
});

test("filter chips map to action groups", () => {
  assert.deepEqual(filterToParams(""), {});
  assert.deepEqual(filterToParams("unknown-id"), {});
  assert.deepEqual(filterToParams("loans"), {
    action_prefixes: ["loans", "book_loans"],
  });
  assert.deepEqual(filterToParams("users"), {
    action_prefixes: ["users", "usersData"],
  });
});
