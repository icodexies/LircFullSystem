import test from "node:test";
import assert from "node:assert/strict";
import {
  departmentVisitNodes,
  programVisitNodes,
  yearLevelVisitNodes,
} from "../../src/services/statistics/visitTree.js";

const tree = [
  {
    label: "DCI",
    visits: 100,
    unique: 40,
    avg_minutes: 60,
    visitors: [{ id: 1, name: "Ana Cruz", library_id: "23-1", role: "student", count: 5 }],
    programs: [
      {
        label: "BSIT",
        visits: 60,
        unique: 25,
        avg_minutes: 45,
        visitors: [{ id: 2, name: "Ben Reyes", library_id: "23-2", role: "student", count: 4 }],
        years: [
          { label: "2", visits: 25, unique: 12, avg_minutes: 30, visitors: [] },
          {
            label: "1",
            visits: 20,
            unique: 10,
            avg_minutes: 40,
            visitors: [{ id: 3, name: "Cara Lim", library_id: "26-1", role: "student", count: 3 }],
          },
        ],
      },
      {
        label: "BSCS",
        visits: 40,
        unique: 15,
        avg_minutes: 50,
        visitors: [],
        years: [
          {
            label: "1",
            visits: 15,
            unique: 6,
            avg_minutes: 20,
            visitors: [{ id: 3, name: "Cara Lim", library_id: "26-1", role: "student", count: 2 }],
          },
        ],
      },
    ],
  },
  { label: "DBA", visits: 30, unique: 10, avg_minutes: 90, visitors: [], programs: [] },
];

test("departments list biggest first with programs and year levels beneath", () => {
  const nodes = departmentVisitNodes(tree);
  assert.deepEqual(
    nodes.map((node) => [node.label, node.count]),
    [
      ["DCI", 100],
      ["DBA", 30],
    ],
  );
  assert.equal(nodes[0].childrenLabel, "Programs");
  assert.deepEqual(
    nodes[0].children.map((program) => program.label),
    ["BSIT", "BSCS"],
  );
  assert.equal(nodes[0].children[0].sub, "DCI");
  assert.equal(nodes[0].children[0].childrenLabel, "Year levels");
  assert.deepEqual(
    nodes[0].children[0].children.map((year) => [year.label, year.count]),
    [
      ["1st year", 20],
      ["2nd year", 25],
    ],
  );
  assert.equal(nodes[0].children[0].children[1].avgMinutes, 30);
  assert.equal(nodes[0].visitors[0].name, "Ana Cruz");
});

test("programs flatten across departments, biggest first", () => {
  const nodes = programVisitNodes(tree);
  assert.deepEqual(
    nodes.map((program) => [program.label, program.sub, program.count]),
    [
      ["BSIT", "DCI", 60],
      ["BSCS", "DCI", 40],
    ],
  );
  assert.deepEqual(
    nodes[0].children.map((year) => year.label),
    ["1st year", "2nd year"],
  );
});

test("year levels add up across programs and merge their visitors", () => {
  const nodes = yearLevelVisitNodes(tree);
  assert.deepEqual(
    nodes.map((year) => [year.label, year.count]),
    [
      ["1st year", 35],
      ["2nd year", 25],
    ],
  );
  // Cara Lim visited in both programs' 1st year lists and merges to 5.
  assert.deepEqual(
    nodes[0].visitors.map((person) => [person.name, person.count]),
    [["Cara Lim", 5]],
  );
  assert.deepEqual(
    nodes[0].children.map((program) => [program.label, program.sub, program.count]),
    [
      ["BSIT", "DCI", 20],
      ["BSCS", "DCI", 15],
    ],
  );
});
