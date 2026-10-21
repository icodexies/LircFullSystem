import test from "node:test";
import assert from "node:assert/strict";
import {
  PERSON_STATUS_OPTIONS,
  PERSON_STATUS_VALUES,
  personStatusLabel,
  personStatusTone,
} from "../../src/services/users/personStatus.js";

test("status options start with the nullable choice", () => {
  assert.equal(PERSON_STATUS_OPTIONS[0].value, "");
  assert.deepEqual(PERSON_STATUS_VALUES, [
    "active",
    "on_leave",
    "retired",
    "resigned",
    "separated",
    "deceased",
  ]);
});

test("labels are readable and unknown values stay empty", () => {
  assert.equal(personStatusLabel("on_leave"), "On leave");
  assert.equal(personStatusLabel("DECEASED"), "Deceased");
  assert.equal(personStatusLabel(null), "");
  assert.equal(personStatusLabel(""), "");
  assert.equal(personStatusLabel("other"), "");
});

test("tones separate active, warnings and deceased", () => {
  assert.equal(personStatusTone("active"), "success");
  assert.equal(personStatusTone("deceased"), "danger");
  assert.equal(personStatusTone("resigned"), "warning");
  assert.equal(personStatusTone("separated"), "warning");
  assert.equal(personStatusTone("retired"), "muted");
  assert.equal(personStatusTone(null), "muted");
});
