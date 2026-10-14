import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCard,
  estimatedLevel,
  manilaBoundary,
  manilaDate,
  isPastAcademicYear,
  timeInReason,
  enrollmentPayload,
  csvCell,
} from "../../src/services/attendance/attendanceRules.js";
import {
  chooseSemester,
  applySemesterFilter,
  periodPreferenceKey,
} from "../../src/services/periods/periodRules.js";
import { reportFilters } from "../../src/services/attendance/reportFilters.js";
const now = new Date("2026-10-09T02:00:00Z");
const period = {
  id: 2,
  academic_year_id: 1,
  starts_on: "2026-07-01",
  ends_on: "2027-01-15",
};
const student = { id: 5, role: "student", library_id: "22-005", user_id: null };
const preview = {
  profile: student,
  active_semester: period,
  enrollment: {
    status: "enrolled",
    validated_at: now.toISOString(),
    year_level: 4,
    year_level_note: "Verified returning student",
  },
  open_visit: null,
};
test("cards preserve leading zeros/internal characters and remove only paired wrapper", () => {
  assert.equal(normalizeCard(" *00-001* "), "00-001");
  assert.equal(normalizeCard("00-0 01"), "00-0 01");
  assert.equal(normalizeCard("*00-001"), "*00-001");
  assert.throws(() => normalizeCard("  "));
});
test("estimate uses academic-year start, never increments on second semester or labels admission age as year five", () => {
  assert.equal(estimatedLevel("22-005", 2026), null);
  assert.equal(estimatedLevel("23-005", 2026), 4);
  assert.equal(estimatedLevel("26-001", 2026), 1);
  assert.equal(estimatedLevel("unsupported", 2026), null);
  assert.equal(estimatedLevel("99-001", 2026), null);
});
test("student time-in requires purpose and a complete library validation; historical views never time in", () => {
  assert.match(timeInReason(preview, 2, "", "", now), /purpose/);
  assert.equal(timeInReason(preview, 2, "Reading", "", now), "");
  assert.match(
    timeInReason({ ...preview, enrollment: null }, 2, "Reading", "", now),
    /not verified/,
  );
  assert.match(
    timeInReason(
      {
        ...preview,
        enrollment: { ...preview.enrollment, status: "withdrawn" },
      },
      2,
      "Reading",
      "",
      now,
    ),
    /not complete/,
  );
  assert.match(timeInReason(preview, 1, "Reading", "", now), /historical/);
  assert.match(
    timeInReason({ ...preview, open_visit: { id: 10 } }, 2, "Reading", "", now),
    /open visit/,
  );
  assert.match(timeInReason(preview, 2, "Other", " ", now), /Describe/);
});
test("faculty and personnel without Auth accounts bypass student validation", () => {
  for (const role of [
    "faculty",
    "non_teaching_personnel",
    "admin",
    "librarian",
  ])
    assert.equal(
      timeInReason(
        { ...preview, profile: { ...student, role }, enrollment: null },
        2,
        "Research",
        "",
        now,
      ),
      "",
    );
});
test("library validation sends only the status; protected fields are ignored", () => {
  const payload = enrollmentPayload(
    {
      status: "enrolled",
      year_level: "4",
      validation_reference: "Confirmed list",
      year_level_note: "Returning student",
      legacy_semester_id: 99,
      academic_year_id: 99,
      validated_by: 88,
    },
    student,
    { id: 1, start_year: 2026 },
  );
  assert.deepEqual(payload, { status: "enrolled" });
  assert.throws(
    () => enrollmentPayload({ status: "missing" }, student, { id: 1 }),
    /status/,
  );
  assert.throws(
    () => enrollmentPayload({ status: "enrolled" }, student, null),
    /academic year/,
  );
  assert.throws(
    () =>
      enrollmentPayload({ status: "enrolled" }, { role: "faculty" }, { id: 1 }),
    /students/,
  );
});
test("Manila midnight and exclusive next-day boundaries ignore the browser timezone", () => {
  assert.equal(manilaBoundary("2026-10-09"), "2026-10-08T16:00:00.000Z");
  assert.equal(manilaBoundary("2026-10-09", true), "2026-10-09T16:00:00.000Z");
  assert.equal(manilaDate(new Date("2026-10-08T16:00:00Z")), "2026-10-09");
  assert.throws(() => manilaBoundary("2026-02-30"));
  const filters = reportFilters({
    arrival_from_day: "2026-10-09",
    arrival_to_day: "2026-10-09",
    role: "student",
  });
  assert.equal(filters.arrival_to, "2026-10-09T16:00:00.000Z");
  assert.equal(filters.role, "student");
});
test("personal semester preference validates saved IDs and uses distinct per-user storage keys", () => {
  const rows = [
    { id: 1, is_active: false },
    { id: 2, is_active: true },
  ];
  assert.equal(chooseSemester(rows, "1").id, 1);
  assert.equal(chooseSemester(rows, "missing").id, 2);
  assert.equal(rows[1].is_active, true);
  assert.equal(chooseSemester([], "1"), null);
  assert.notEqual(periodPreferenceKey("a"), periodPreferenceKey("b"));
  assert.throws(() => applySemesterFilter({}, null));
  const calls = [];
  applySemesterFilter({ eq: (...args) => calls.push(args) }, 2);
  assert.deepEqual(calls, [["semester_id", 2]]);
});
test("export cells prevent spreadsheet formulas and escape quotes", () => {
  assert.equal(csvCell("=SUM(A1)"), '"\'=SUM(A1)"');
  assert.equal(csvCell('A "quoted" name'), '"A ""quoted"" name"');
});

test("past school years are detected using Manila dates", () => {
  assert.equal(isPastAcademicYear({ ends_on: "2026-05-31" }, "2026-10-12"), true);
  assert.equal(isPastAcademicYear({ ends_on: "2027-05-31" }, "2026-10-12"), false);
  assert.equal(isPastAcademicYear({ ends_on: "2026-10-12" }, "2026-10-12"), false);
  assert.equal(isPastAcademicYear(null, "2026-10-12"), false);
});

test("legacy enrolled year five needs review until the record is saved again", () => {
  const invalid = { ...preview, enrollment: { ...preview.enrollment, year_level: 5 } };
  assert.match(timeInReason(invalid, 2, "Reading", "", now), /needs review/);
  // Saving again sends only the status; the database then derives the level.
  assert.deepEqual(
    enrollmentPayload(
      {
        status: "enrolled",
        year_level: "5",
        validation_reference: "Confirmed list",
        year_level_note: "Review",
      },
      student,
      { id: 1, start_year: 2026 },
    ),
    { status: "enrolled" },
  );
});
