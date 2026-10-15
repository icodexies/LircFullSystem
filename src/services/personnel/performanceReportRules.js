// Pure helpers for the monthly AI summaries: month values, the fixed rating
// tones and the report model the PDF and the view window render. Data
// shaping only — the score itself comes from the AI.
import { manilaDate } from "../attendance/attendanceRules.js";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// The six rating levels. The AI returns the score; the level is fixed here.
export const RATING_TONES = [
  {
    min: 90,
    key: "excellent",
    chip: "bg-jade text-white",
    pdfBg: [15, 138, 107],
    pdfFg: [255, 255, 255],
  },
  {
    min: 80,
    key: "very-good",
    chip: "bg-jade-soft text-jade-deep",
    pdfBg: [231, 244, 239],
    pdfFg: [11, 107, 82],
  },
  {
    min: 70,
    key: "good",
    chip: "bg-tint text-accent",
    pdfBg: [240, 237, 250],
    pdfFg: [59, 74, 134],
  },
  {
    min: 60,
    key: "satisfactory",
    chip: "bg-slate-100 text-slate-700",
    pdfBg: [241, 245, 249],
    pdfFg: [51, 65, 85],
  },
  {
    min: 45,
    key: "needs-improvement",
    chip: "bg-amber-50 text-amber-900",
    pdfBg: [255, 251, 235],
    pdfFg: [120, 53, 15],
  },
  {
    min: 0,
    key: "unsatisfactory",
    chip: "bg-red-50 text-red-700",
    pdfBg: [254, 242, 242],
    pdfFg: [185, 28, 28],
  },
];

export function ratingTone(score) {
  const value = Number(score ?? 0);
  for (const tone of RATING_TONES) if (value >= tone.min) return tone;
  return RATING_TONES[RATING_TONES.length - 1];
}

// How the month compares with the person's own previous months.
export const TREND_TONES = {
  Improved: { chip: "bg-jade-soft text-jade-deep", arrow: "↑" },
  Steady: { chip: "bg-slate-100 text-slate-700", arrow: "→" },
  Declined: { chip: "bg-amber-50 text-amber-900", arrow: "↓" },
  "First month": { chip: "bg-tint text-accent", arrow: "•" },
};

export function trendTone(trend) {
  return TREND_TONES[trend] ?? null;
}

// "YYYY-MM" of the month before the given moment, in Philippine time.
export function lastMonthValue(now = new Date()) {
  const [year, month] = manilaDate(now).split("-").map(Number);
  const previous = new Date(Date.UTC(year, month - 2, 1));
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(value) {
  const [year, month] = String(value ?? "").split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) return String(value ?? "");
  return `${MONTHS[month - 1]} ${year}`;
}

// The ordered content the PDF and the view window render.
export function buildReportModel(report, profileName) {
  const summary = report?.summary ?? {};
  return {
    person: profileName ?? "",
    month: monthLabel(report?.period_month),
    monthValue: String(report?.period_month ?? "").slice(0, 7),
    score: Number(report?.rating_score ?? 0),
    label: report?.rating_label ?? "",
    trend: String(summary.trend ?? ""),
    headline: String(report?.headline ?? ""),
    paragraphs: [String(summary.summary ?? "")].filter(Boolean),
    sections: [
      { title: "Strengths", items: summary.strengths ?? [] },
      { title: "Concerns", items: summary.concerns ?? [] },
      { title: "Recommendations", items: summary.recommendations ?? [] },
    ].filter((section) => section.items.length > 0),
    stats: [
      ["Actions recorded", summary.stats?.actions],
      ["Active days", summary.stats?.active_days],
      ["Distinct action types", summary.signals?.distinct_action_types],
      ["Most repeated action share", summary.signals?.max_single_action_share],
    ].filter(([, value]) => value !== undefined && value !== null && value !== ""),
    generatedAt: report?.created_at ?? null,
    model: report?.model ?? "",
  };
}
