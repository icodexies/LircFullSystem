import test from "node:test";
import assert from "node:assert/strict";
import {
  rankMembers,
  scoreMember,
  searchWords,
} from "../../src/services/borrow/memberSearch.js";

const members = [
  {
    id: 1,
    full_name: "Villanueva, Sam D.",
    library_id: "26-00001",
    role: "student",
  },
  {
    id: 2,
    full_name: "VILLANUEVA, Danyca Alliah",
    library_id: "23-9678",
    role: "student",
  },
  {
    id: 3,
    full_name: "VILLANUEVA, Vien Benedict A.",
    library_id: "23-8625",
    role: "student",
  },
  {
    id: 4,
    full_name: "Villanueva, Leah C.",
    library_id: "22-7387",
    role: "student",
  },
  {
    id: 5,
    full_name: "Reyes, Maria S.",
    library_id: "LIB-0002",
    role: "librarian",
  },
  {
    id: 6,
    full_name: "TIQUI, Zeny Rose N.",
    library_id: "26-15261",
    role: "student",
  },
  {
    id: 7,
    full_name: "Dela Cruz, José M.",
    library_id: "24-01111",
    role: "faculty",
  },
];

test("searchWords drops commas and periods so initials compare cleanly", () => {
  assert.deepEqual(searchWords("Villanueva, D."), ["villanueva", "d"]);
  assert.deepEqual(searchWords("  sma   Villanueba "), ["sma", "villanueba"]);
});

test("name words work in any order", () => {
  assert.equal(rankMembers(members, "reyes maria")[0].id, 5);
  assert.equal(rankMembers(members, "maria reyes")[0].id, 5);
  assert.equal(rankMembers(members, "villanueva sam")[0].id, 1);
});

test("middle initial then surname puts the initial's owner first", () => {
  const ranked = rankMembers(members, "d villanueva");
  assert.equal(ranked[0].id, 1);
  // Danyca's first name also starts with D, but an exact initial wins.
  assert.equal(ranked[1].id, 2);
});

test("a typo in one word still scores the right member highest", () => {
  assert.ok(scoreMember(members[0], searchWords("villanueba")) > 0.8);
  const ranked = rankMembers(members, "villanueba");
  assert.equal(ranked[0].id, 1);
});

test("a typo in two words matches per word, not the whole sentence", () => {
  const ranked = rankMembers(members, "sma villanueba", { minScore: 0.55 });
  assert.equal(ranked[0].id, 1);
  assert.equal(ranked.length, 1);
});

test("unrelated words find nothing", () => {
  assert.deepEqual(rankMembers(members, "zzzz qqq"), []);
  assert.deepEqual(rankMembers(members, "zzzz qqq", { minScore: 0.55 }), []);
});

test("cards match with or without the hyphen", () => {
  assert.equal(rankMembers(members, "26-00001")[0].id, 1);
  assert.equal(rankMembers(members, "2600001")[0].id, 1);
  assert.equal(rankMembers(members, "26-15261")[0].id, 6);
});

test("accents do not block a name match", () => {
  assert.equal(rankMembers(members, "jose dela cruz")[0].id, 7);
});
