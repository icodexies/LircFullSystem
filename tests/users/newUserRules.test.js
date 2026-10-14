import test from "node:test";
import assert from "node:assert/strict";
import {
  MEMBER_LIMITS,
  buildErrorReportCsv,
  buildTemplateCsv,
  cardEstimate,
  isStudentRole,
  ordinalLevel,
  parseCsv,
  roleOptions,
  rowsFromCsv,
  validateNewMember,
} from "../../src/services/users/newUserRules.js";

test("member form requires the core fields and trims values", () => {
  const { error, clean } = validateNewMember({
    library_id: " 26-0001 ",
    first_name: " Ana ",
    surname: " Reyes ",
    role: "student",
  });
  assert.equal(error, "");
  assert.equal(clean.library_id, "26-0001");
  assert.equal(clean.first_name, "Ana");
  assert.equal(clean.surname, "Reyes");
});

test("member form reports missing fields and long values", () => {
  assert.equal(validateNewMember({}).error, "Library ID is required.");
  assert.equal(
    validateNewMember({ library_id: "1" }).error,
    "First name is required.",
  );
  assert.equal(
    validateNewMember({ library_id: "1", first_name: "A" }).error,
    "Surname is required.",
  );
  assert.equal(
    validateNewMember({
      library_id: "x".repeat(MEMBER_LIMITS.library_id + 1),
      first_name: "A",
      surname: "B",
      role: "student",
    }).error,
    `Library ID must be ${MEMBER_LIMITS.library_id} characters or fewer.`,
  );
  assert.equal(
    validateNewMember({
      library_id: "1",
      first_name: "A",
      surname: "B",
      middle_initial: "ABC",
      role: "student",
    }).error,
    "Middle initial must be 2 characters or fewer.",
  );
});

test("admin role can only be assigned by an admin", () => {
  const form = {
    library_id: "1",
    first_name: "A",
    surname: "B",
    role: "admin",
  };
  assert.equal(
    validateNewMember(form, { isAdmin: false }).error,
    "Only an admin can add another admin.",
  );
  assert.equal(validateNewMember(form, { isAdmin: true }).error, "");
  assert.equal(
    validateNewMember({ ...form, role: "wizard" }).error,
    "Choose a valid role.",
  );
});

test("role options hide admin from non-admins", () => {
  assert.ok(roleOptions(true).some((row) => row.value === "admin"));
  assert.ok(!roleOptions(false).some((row) => row.value === "admin"));
});

test("role-relevant fields only are kept", () => {
  const student = validateNewMember({
    library_id: "1",
    first_name: "A",
    surname: "B",
    role: "student",
    program_id: "13",
    position_classification_id: "1",
  }).clean;
  assert.equal(student.program_id, "13");
  assert.equal(student.position_classification_id, "");
  const faculty = validateNewMember({
    library_id: "1",
    first_name: "A",
    surname: "B",
    role: "faculty",
    program_id: "13",
    position_classification_id: "1",
  }).clean;
  assert.equal(faculty.program_id, "");
  assert.equal(faculty.position_classification_id, "1");
});

test("csv parser handles quotes, commas, CRLF and line numbers", () => {
  const rows = parseCsv('a,b\n"one, two","say ""hi"""\n');
  assert.deepEqual(rows[0], { line: 1, values: ["a", "b"] });
  assert.deepEqual(rows[1], { line: 2, values: ["one, two", 'say "hi"'] });
  const crlf = parseCsv("\uFEFFa,b\r\n1,2\r\n");
  assert.deepEqual(crlf[0].values, ["a", "b"]);
  assert.deepEqual(crlf[1], { line: 2, values: ["1", "2"] });
});

test("csv rows map to the known columns with file row numbers", () => {
  const parsed = parseCsv(
    "library_id,first_name,surname,role,year_level,extra\n26-1,Ana,Reyes,student,2,ignored\n\n26-2,Ben,Cruz,faculty,,\n",
  );
  const { error, rows } = rowsFromCsv(parsed);
  assert.equal(error, "");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].row, 2);
  assert.equal(rows[0].library_id, "26-1");
  assert.equal(rows[0].year_level, "2");
  assert.equal("extra" in rows[0], false);
  assert.equal(rows[1].row, 4);
  assert.equal(rows[1].role, "faculty");
});

test("csv rows require the core header columns", () => {
  const { error } = rowsFromCsv(parseCsv("name,role\nAna,student\n"));
  assert.match(error, /header row/);
});

test("templates include the right columns", () => {
  assert.equal(
    buildTemplateCsv("student"),
    "library_id,first_name,surname,middle_initial,suffix,role,department_id,program_id,position_classification_id,year_level,year_level_note\r\n",
  );
  assert.equal(
    buildTemplateCsv("personnel"),
    "library_id,first_name,surname,middle_initial,suffix,role,department_id,program_id,position_classification_id\r\n",
  );
});

test("error report lists only the failed rows", () => {
  const csv = buildErrorReportCsv([
    { row: 2, library_id: "A-1", ok: true },
    {
      row: 3,
      library_id: "A-2",
      ok: false,
      reason: "First name is required.",
    },
  ]);
  assert.equal(
    csv,
    'row,library_id,reason\r\n3,"A-2","First name is required."\r\n',
  );
});

test("card estimate follows the library card year", () => {
  assert.equal(cardEstimate("26-1234", { start_year: 2026 }), "1st year");
  assert.equal(cardEstimate("23-1234", { start_year: 2026 }), "4th year");
  assert.equal(cardEstimate("ABC", { start_year: 2026 }), "");
  assert.equal(ordinalLevel(3), "3rd year");
  assert.equal(isStudentRole(" Student "), true);
});
