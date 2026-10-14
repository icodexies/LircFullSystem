import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReportModel,
  lastMonthValue,
  monthLabel,
  ratingTone,
  trendTone,
} from "../../src/services/personnel/performanceReportRules.js";

test("the six rating levels follow the score", () => {
  assert.equal(ratingTone(100).key, "excellent");
  assert.equal(ratingTone(90).key, "excellent");
  assert.equal(ratingTone(89).key, "very-good");
  assert.equal(ratingTone(70).key, "good");
  assert.equal(ratingTone(60).key, "satisfactory");
  assert.equal(ratingTone(45).key, "needs-improvement");
  assert.equal(ratingTone(44).key, "unsatisfactory");
  assert.equal(ratingTone(0).key, "unsatisfactory");
});

test("last month follows Philippine time across a year boundary", () => {
  assert.equal(lastMonthValue(new Date("2026-10-15T02:00:00Z")), "2026-09");
  assert.equal(lastMonthValue(new Date("2026-01-15T02:00:00Z")), "2025-12");
  // 2026-01-01 00:30 in Manila is still 2025 in UTC
  assert.equal(lastMonthValue(new Date("2025-12-31T16:30:00Z")), "2025-12");
});

test("month labels read as words", () => {
  assert.equal(monthLabel("2026-09"), "September 2026");
  assert.equal(monthLabel("2026-01-01"), "January 2026");
  assert.equal(monthLabel(""), "");
});

test("the report model orders the content the PDF draws", () => {
  const model = buildReportModel(
    {
      period_month: "2026-09-01",
      rating_score: 82,
      rating_label: "Very good",
      headline: "A steady month",
      summary: {
        summary: "Paragraph.",
        trend: "Improved",
        strengths: ["One"],
        concerns: [],
        recommendations: ["Do more"],
        stats: { actions: 120, active_days: 18 },
        signals: { distinct_action_types: 9, max_single_action_share: 0.4 },
      },
      model: "gemini-3.8-flash",
      created_at: "2026-10-01T00:00:00Z",
    },
    "Maria Reyes",
  );
  assert.equal(model.person, "Maria Reyes");
  assert.equal(model.month, "September 2026");
  assert.equal(model.monthValue, "2026-09");
  assert.equal(model.score, 82);
  assert.equal(model.label, "Very good");
  assert.equal(model.trend, "Improved");
  assert.deepEqual(
    model.sections.map((section) => section.title),
    ["Strengths", "Recommendations"],
  );
  assert.deepEqual(model.stats, [
    ["Actions recorded", 120],
    ["Active days", 18],
    ["Distinct action types", 9],
    ["Most repeated action share", 0.4],
  ]);
});

test("trend chips cover the four states and reject unknown ones", () => {
  assert.equal(trendTone("Improved").arrow, "↑");
  assert.equal(trendTone("Declined").arrow, "↓");
  assert.equal(trendTone("Steady").arrow, "→");
  assert.equal(trendTone("First month").arrow, "•");
  assert.equal(trendTone("unknown"), null);
  assert.equal(trendTone(undefined), null);
});
