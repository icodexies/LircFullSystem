import test from "node:test";
import assert from "node:assert/strict";
import {
  memberFormFromProfile,
  memberChanges,
  memberChangesError,
} from "../../src/services/users/memberEditRules.js";

const profile = {
  first_name: "Juan",
  surname: "Dela Cruz",
  middle_initial: "S",
  suffix: null,
  department_id: 2,
  program_id: 5,
  position_classification_id: null,
};

test("member form is seeded from the profile with string ids", () => {
  assert.deepEqual(memberFormFromProfile(profile), {
    first_name: "Juan",
    surname: "Dela Cruz",
    middle_initial: "S",
    suffix: "",
    department_id: "2",
    program_id: "5",
    position_classification_id: "",
  });
});

test("only real changes are kept (trimmed, ids as strings)", () => {
  const changes = memberChanges(profile, {
    first_name: " Juan ",
    surname: "Dela Cruz",
    middle_initial: "S",
    suffix: "",
    department_id: "2",
    program_id: "7",
    position_classification_id: "",
  });
  assert.deepEqual(changes, { program_id: "7" });
});

test("clearing a classification becomes an empty change value", () => {
  const changes = memberChanges(profile, {
    ...memberFormFromProfile(profile),
    department_id: "",
  });
  assert.deepEqual(changes, { department_id: "" });
});

test("edit rules mirror the database checks", () => {
  assert.match(memberChangesError({}), /Nothing changed/);
  assert.match(memberChangesError({ first_name: "  " }), /First name/);
  assert.match(
    memberChangesError({ surname: "x".repeat(101) }),
    /100 characters/,
  );
  assert.equal(memberChangesError({ program_id: "7" }), "");
});
