// Chart ink for the statistics detail pages. The design guide allows only the
// page tokens on data pages — navy, #3B4A86 and lavender tints — so every
// line, bar and donut segment comes from this family (no other hues).
//
// The values are CSS variables defined in index.css for both themes, so the
// charts follow the light/dark switch. SVG parts must apply them through
// `style` (CSS properties) — var() does not resolve in presentation
// attributes like stroke="…".
export const INK = {
  navy: "var(--chart-1)",
  indigo: "var(--chart-2)",
  lavender: "var(--chart-3)", // mid lavender tint (between #F0EDFA and #3B4A86)
};

// Donut segments: shades and tints of the same navy → lavender family.
export const SHARE_COLORS = [
  "var(--chart-share-1)",
  "var(--chart-share-2)",
  "var(--chart-share-3)",
  "var(--chart-share-4)",
  "var(--chart-share-5)",
  "var(--chart-share-6)",
  "var(--chart-share-7)",
];
