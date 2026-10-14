import test from "node:test";
import assert from "node:assert/strict";
import {
  describeAttendanceFilters,
  summarizeAttendance,
  visitorSections,
  yearLabel,
} from "../../src/services/attendance/attendanceReportRules.js";

// Ten visits: two by the same student, DCI/DBA departments, faculty with
// positions, one personnel row and one student with no department.
const rows = [
  { user_profile_id: 1, role: "student", department: "DCI", program: "IT", year_level: 4, purpose: "Study" },
  { user_profile_id: 1, role: "student", department: "DCI", program: "IT", year_level: 4, purpose: "Borrow Books" },
  { user_profile_id: 2, role: "student", department: "DCI", program: "IT", year_level: 3, purpose: "Study" },
  { user_profile_id: 3, role: "student", department: "DCI", program: "CS", year_level: 3, purpose: "Study" },
  { user_profile_id: 4, role: "student", department: "DCI", program: "CS", year_level: 4, purpose: "Study" },
  { user_profile_id: 5, role: "student", department: "DBA", program: "BA", year_level: 2, purpose: "Study" },
  { user_profile_id: 6, role: "faculty", department: "DCI", program: null, position: "Instructor", purpose: "Research" },
  { user_profile_id: 7, role: "faculty", department: "DCI", program: null, position: "Instructor", purpose: "Research" },
  { user_profile_id: 8, role: "non_teaching_personnel", department: null, program: null, position: "Library Aide", purpose: "INTERVIEW" },
  { user_profile_id: 9, role: "student", department: null, program: null, year_level: 1, purpose: "Study" },
];

test("summary totals count visits and unique visitors", () => {
  const summary = summarizeAttendance(rows);
  assert.equal(summary.total, 10);
  assert.equal(summary.uniqueVisitors, 9);
});

test("visits are counted by visitor type with the friendly role names", () => {
  const summary = summarizeAttendance(rows);
  assert.deepEqual(summary.byRole, [
    { label: "Student", count: 7 },
    { label: "Faculty", count: 2 },
    { label: "Non-teaching personnel", count: 1 },
  ]);
});

test("visits are counted by purpose, biggest first", () => {
  const summary = summarizeAttendance(rows);
  assert.deepEqual(summary.byPurpose, [
    { label: "Study", count: 6 },
    { label: "Research", count: 2 },
    { label: "Borrow Books", count: 1 },
    { label: "INTERVIEW", count: 1 },
  ]);
});

test("departments read as one tree: programs, then year levels and staff", () => {
  const summary = summarizeAttendance(rows);
  assert.deepEqual(summary.departments, [
    {
      department: "DCI",
      count: 7,
      programs: [
        {
          label: "IT",
          count: 3,
          years: [
            { label: "3rd year", count: 1 },
            { label: "4th year", count: 2 },
          ],
          staff: 0,
        },
        { label: "(No program)", count: 2, years: [], staff: 2 },
        {
          label: "CS",
          count: 2,
          years: [
            { label: "3rd year", count: 1 },
            { label: "4th year", count: 1 },
          ],
          staff: 0,
        },
      ],
    },
    {
      department: "(No department)",
      count: 2,
      programs: [
        {
          label: "(No program)",
          count: 2,
          years: [{ label: "1st year", count: 1 }],
          staff: 1,
        },
      ],
    },
    {
      department: "DBA",
      count: 1,
      programs: [
        {
          label: "BA",
          count: 1,
          years: [{ label: "2nd year", count: 1 }],
          staff: 0,
        },
      ],
    },
  ]);
});

test("year lines keep study order, not count order", () => {
  const summary = summarizeAttendance([
    { user_profile_id: 1, role: "student", department: "DCI", program: "IT", year_level: 4, purpose: "Study" },
    { user_profile_id: 2, role: "student", department: "DCI", program: "IT", year_level: 2, purpose: "Study" },
    { user_profile_id: 3, role: "student", department: "DCI", program: "IT", year_level: 4, purpose: "Study" },
    { user_profile_id: 4, role: "student", department: "DCI", program: "IT", year_level: 4, purpose: "Study" },
  ]);
  assert.deepEqual(summary.departments[0].programs[0].years, [
    { label: "2nd year", count: 1 },
    { label: "4th year", count: 3 },
  ]);
});

test("non-student visits are counted by position", () => {
  const summary = summarizeAttendance(rows);
  assert.deepEqual(summary.byPosition, [
    { label: "Instructor", count: 2 },
    { label: "Library Aide", count: 1 },
  ]);
});

test("year labels stay readable for every level", () => {
  assert.equal(yearLabel(1), "1st year");
  assert.equal(yearLabel(4), "4th year");
  assert.equal(yearLabel(null), "Year not set");
  assert.equal(yearLabel(5), "Year 5");
});

test("applied filters are described in words", () => {
  assert.deepEqual(describeAttendanceFilters({}), []);
  assert.deepEqual(describeAttendanceFilters({ role: "student" }), [
    "Visitor type: Student",
  ]);
  assert.deepEqual(describeAttendanceFilters({ status: "open" }), [
    "Visit status: Still inside",
  ]);
  const lines = describeAttendanceFilters({
    arrival_from: "2026-10-01T00:00:00.000Z",
    search: "dela cruz",
    search_by: "full_name",
    sort: "name",
    direction: "desc",
  });
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^Visit date from: Oct 1, 2026/);
  assert.equal(lines[1], "Search: dela cruz");
});

test("unique visitors carry their entry count, organized for the report", () => {
  const rows = [
    { user_profile_id: 1, role: "student", department: "DCI", program: "IT", year_level: 2, full_name: "Mark Ian Dagos", library_id: "23-001", time_in: "2026-10-01T02:00:00Z" },
    { user_profile_id: 1, role: "student", department: "DCI", program: "IT", year_level: 3, full_name: "Mark Ian Dagos", library_id: "23-001", time_in: "2026-10-05T02:00:00Z" },
    { user_profile_id: 2, role: "student", department: "DCI", program: "CS", year_level: 4, full_name: "Ana Cruz", library_id: "23-002", time_in: "2026-10-02T02:00:00Z" },
    { user_profile_id: 3, role: "student", department: null, program: null, year_level: 1, full_name: "No Dept", library_id: "23-003", time_in: "2026-10-02T03:00:00Z" },
    { user_profile_id: 4, role: "faculty", department: "DCI", position: "Instructor", full_name: "Ben Reyes", library_id: "F-001", time_in: "2026-10-03T02:00:00Z" },
    { user_profile_id: 5, role: "non_teaching_personnel", position: "Library Aide", full_name: "Cara Lim", library_id: "N-001", time_in: "2026-10-03T02:00:00Z" },
    { user_profile_id: 6, role: "librarian", position: "Librarian", full_name: "Dina Santos", library_id: "LIB-0001", time_in: "2026-10-03T02:00:00Z" },
    { user_profile_id: 7, role: "guest", guest_name: "Juan Visitor", library_id: "GUEST-01", time_in: "2026-10-04T02:00:00Z" },
    { user_profile_id: 7, role: "guest", guest_name: "Juan Visitor", library_id: "GUEST-01", time_in: "2026-10-06T02:00:00Z" },
    { user_profile_id: 7, role: "guest", guest_name: "Another Guest", library_id: "GUEST-01", time_in: "2026-10-06T03:00:00Z" },
  ];
  const visitors = visitorSections(rows);
  assert.equal(visitors.total, 8);

  // Students: department -> program, each person with their entry count.
  assert.deepEqual(
    visitors.students.map((dept) => [dept.department, dept.students, dept.visits]),
    [
      ["DCI", 2, 3],
      ["(No department)", 1, 1],
    ],
  );
  assert.deepEqual(
    visitors.students[0].programs.map((p) => [p.program, p.visits, p.persons.length]),
    [
      ["IT", 2, 1],
      ["CS", 1, 1],
    ],
  );
  const mark = visitors.students[0].programs[0].persons[0];
  assert.equal(mark.name, "Mark Ian Dagos");
  assert.equal(mark.visits, 2);
  assert.equal(mark.year_level, 3); // the year level from the latest visit
  assert.equal(visitors.students[1].programs[0].program, "(No program)");

  // The non-student sections in order, grouped as the library reads them.
  assert.deepEqual(
    visitors.sections.map((section) => section.title),
    [
      "Faculty — by position",
      "Non-teaching personnel — by position",
      "Library personnel",
      "Guests — one line per guest card and typed name",
    ],
  );
  assert.equal(visitors.sections[0].groups[0].label, "Instructor");
  assert.equal(visitors.sections[0].groups[0].persons[0].visits, 1);
  assert.equal(visitors.sections[1].groups[0].label, "Library Aide");
  assert.equal(visitors.sections[2].groups[0].label, "Librarian");

  // Guests: the same card + typed name is one person; a new name is its own.
  assert.deepEqual(
    visitors.sections[3].groups[0].persons.map((p) => [p.name, p.visits]),
    [
      ["Juan Visitor", 2],
      ["Another Guest", 1],
    ],
  );
});
