import test from "node:test";
import assert from "node:assert/strict";
import {
  signInSourceNote,
  donutSegments,
  barSeries,
  shortDay,
  CHART_COLORS,
} from "../../src/services/personnel/personnelRules.js";

test("sign-in source note is honest about the data source", () => {
  assert.match(signInSourceNote("audit"), /audit log/i);
  assert.match(signInSourceNote("sessions"), /session records only/i);
  assert.match(signInSourceNote("sessions"), /Write audit logs/i);
});

test("donut segments keep counts, shares and palette colors", () => {
  const segments = donutSegments([
    { key: "inventory", count: 3 },
    { key: "other", count: 1 },
    { key: "loans", count: 0 },
  ]);
  assert.equal(segments.length, 2);
  assert.deepEqual(
    segments.map((segment) => segment.label),
    ["Inventory", "Other"],
  );
  assert.deepEqual(
    segments.map((segment) => segment.value),
    [3, 1],
  );
  assert.deepEqual(
    segments.map((segment) => segment.pct),
    [75, 25],
  );
  assert.equal(segments[0].color, CHART_COLORS[0]);
  assert.equal(segments[1].color, CHART_COLORS[1]);
});

test("donut merges the tail when there are more kinds than colors", () => {
  const groups = Array.from({ length: 10 }, (_, index) => ({
    key: `kind${index}`,
    count: 10 - index,
  }));
  const segments = donutSegments(groups);
  assert.equal(segments.length, CHART_COLORS.length);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  assert.equal(total, groups.reduce((sum, group) => sum + group.count, 0));
});

test("bar series scales to the busiest day and keeps small days visible", () => {
  const { max, bars } = barSeries([
    { day: "2026-10-13", count: 0 },
    { day: "2026-10-14", count: 8 },
    { day: "2026-10-15", count: 1 },
  ]);
  assert.equal(max, 8);
  assert.equal(bars[0].pct, 0);
  assert.equal(bars[1].pct, 100);
  assert.equal(bars[2].pct, 12.5);
});

test("shortDay formats calendar days without timezone pitfalls", () => {
  assert.equal(shortDay("2026-10-14"), "Oct 14");
  assert.equal(shortDay(""), "");
});
