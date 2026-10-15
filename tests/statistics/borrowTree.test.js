import test from "node:test";
import assert from "node:assert/strict";
import {
  departmentNodes,
  programNodes,
  yearLevelNodes,
} from "../../src/services/statistics/borrowTree.js";

const tree = [
  {
    label: "DCI",
    count: 100,
    books: [{ id: 1, name: "Book A", count: 10 }],
    programs: [
      {
        label: "BSIT",
        count: 60,
        books: [{ id: 2, name: "Book B", count: 8 }],
        years: [
          { label: "2", count: 25, books: [{ id: 3, name: "Book C", count: 5 }] },
          { label: "1", count: 20, books: [{ id: 1, name: "Book A", count: 4 }] },
        ],
      },
      {
        label: "BSCS",
        count: 40,
        books: [{ id: 4, name: "Book D", count: 6 }],
        years: [{ label: "1", count: 15, books: [{ id: 1, name: "Book A", count: 3 }] }],
      },
    ],
  },
  {
    label: "DBA",
    count: 30,
    books: [{ id: 5, name: "Book E", count: 7 }],
    programs: [{ label: "BSA", count: 30, books: [], years: [] }],
  },
];

test("departments list biggest first with programs and year levels beneath", () => {
  const nodes = departmentNodes(tree);
  assert.deepEqual(
    nodes.map((node) => node.label),
    ["DCI", "DBA"],
  );
  assert.equal(nodes[0].childrenLabel, "Programs");
  assert.deepEqual(
    nodes[0].children.map((program) => program.label),
    ["BSIT", "BSCS"],
  );
  assert.equal(nodes[0].children[0].sub, "DCI");
  assert.equal(nodes[0].children[0].childrenLabel, "Year levels");
  // Year levels read in study order with friendly labels.
  assert.deepEqual(
    nodes[0].children[0].children.map((year) => [year.label, year.count]),
    [
      ["1st year", 20],
      ["2nd year", 25],
    ],
  );
  assert.equal(nodes[0].children[0].children[1].books[0].name, "Book C");
  // The drill keys stay unique across the tree.
  const keys = [
    ...nodes.map((node) => node.key),
    ...nodes.flatMap((node) => node.children.map((child) => child.key)),
    ...nodes.flatMap((node) =>
      node.children.flatMap((child) => child.children.map((year) => year.key)),
    ),
  ];
  assert.equal(new Set(keys).size, keys.length);
});

test("programs flatten across departments, biggest first", () => {
  const nodes = programNodes(tree);
  assert.deepEqual(
    nodes.map((program) => [program.label, program.sub, program.count]),
    [
      ["BSIT", "DCI", 60],
      ["BSCS", "DCI", 40],
      ["BSA", "DBA", 30],
    ],
  );
  assert.deepEqual(
    nodes[0].children.map((year) => year.label),
    ["1st year", "2nd year"],
  );
});

test("year levels add up across programs and merge their books", () => {
  const nodes = yearLevelNodes(tree);
  assert.deepEqual(
    nodes.map((year) => [year.label, year.count]),
    [
      ["1st year", 35],
      ["2nd year", 25],
    ],
  );
  // Book A appears in both programs' 1st year lists and merges to 7 —
  // and it keeps its book id so the row can still open the OPAC window.
  assert.deepEqual(nodes[0].books, [{ id: 1, name: "Book A", count: 7 }]);
  assert.deepEqual(
    nodes[0].children.map((program) => [program.label, program.sub, program.count]),
    [
      ["BSIT", "DCI", 20],
      ["BSCS", "DCI", 15],
    ],
  );
  assert.equal(nodes[1].children[0].label, "BSIT");
  assert.equal(nodes[1].children[0].children.length, 0);
});
