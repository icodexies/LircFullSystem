import test from "node:test";
import assert from "node:assert/strict";
import {
  describeAttendanceFilters,
  summarizeAttendance,
  yearLabel,
} from "../../src/services/attendance/attendanceReportRules.js";

// Ten visits: two by the same student, DCI/DBA departments, faculty with
// positions, one personnel row and one student with no department.
const rows = [
  { user_profile_id: 1, role: "student", department: "DCI", program: "IT", year_level: 4, purpose: "Reading" },
  { user_profile_id: 1, role: "student", department: "DCI", program: "IT", year_level: 4, purpose: "Borrowing/Returning" },
  { user_profile_id: 2, role: "student", department: "DCI", program: "IT", year_level: 3, purpose: "Reading" },
  { user_profile_id: 3, role: "student", department: "DCI", program: "CS", year_level: 3, purpose: "Reading" },
  { user_profile_id: 4, role: "student", department: "DCI", program: "CS", year_level: 4, purpose: "Studying" },
  { user_profile_id: 5, role: "student", department: "DBA", program: "BA", year_level: 2, purpose: "Reading" },
  { user_profile_id: 6, role: "faculty", department: "DCI", program: null, position: "Instructor", purpose: "Research" },
  { user_profile_id: 7, role: "faculty", department: "DCI", program: null, position: "Instructor", purpose: "Research" },
  { user_profile_id: 8, role: "non_teaching_personnel", department: null, program: null, position: "Library Aide", purpose: "Computer Use" },
  { user_profile_id: 9, role: "student", department: null, program: null, year_level: 1, purpose: "Reading" },
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
    { label: "Reading", count: 5 },
    { label: "Research", count: 2 },
    { label: "Borrowing/Returning", count: 1 },
    { label: "Computer Use", count: 1 },
    { label: "Studying", count: 1 },
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
    { user_profile_id: 1, role: "student", department: "DCI", program: "IT", year_level: 4, purpose: "Reading" },
    { user_profile_id: 2, role: "student", department: "DCI", program: "IT", year_level: 2, purpose: "Reading" },
    { user_profile_id: 3, role: "student", department: "DCI", program: "IT", year_level: 4, purpose: "Reading" },
    { user_profile_id: 4, role: "student", department: "DCI", program: "IT", year_level: 4, purpose: "Reading" },
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
