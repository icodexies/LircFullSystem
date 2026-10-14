# LIRC page design guide

This is the working design manual for the member pages. Every page follows the
same template: **one navy hero panel at the top, white content below**, with
shared chips, tiles, buttons, empty states and loading skeletons.

## Ground rules

1. Keep all logic, hooks, props and data fetching as they are. Only markup and
   classes change.
2. Tailwind core utilities only (no custom config, no `<style>` block).
   Arbitrary values like `bg-[#0B1330]` are fine. One small inline `style`
   object is allowed only for the dot pattern.
3. Don't invent new visual directions. No new accent colors, gradients,
   glassmorphism or heavy shadows. Reuse the tokens and patterns below.
4. Shared wrappers (like `WorkspaceHeader`) keep their names and props.

## Design tokens

- **Base:** white cards on a `#F7F6FB` content canvas; the member sidebar is
  navy.
- **Navy (primary accent):** `#0B1330` for hero panels, primary buttons, active
  page indicator, heading bars.
- **Secondary indigo:** `#3B4A86` for hover states, focus rings, icons, links,
  small chips' text.
- **Accent jade:** `#0F8A6B` — positive accents, charts and the one highlighted
  card per view (tint `#E7F4EF`, dark text `#0B6B52`, dot `#12A47E`). Success
  states use jade, not another green.
- **Tints:** `#F0EDFA` (lavender, for chips/icon badges/skeletons) and
  `#F7F6FB` (very light, for field tiles and panels).
- **Neutrals:** slate-200 container/card borders, slate-400 **control borders
  (inputs and buttons must be visible)**, slate-100 dividers, slate-500 muted
  text/placeholders, slate-600 labels.
- **Status:** jade `#E7F4EF`/`#0B6B52` (available, success), red-50/700
  (errors), amber-50/800 (warnings), slate-100/600 (neutral status).
- **Typography:** `font-serif` for page titles, card titles and empty-state
  headings. Text sizes: labels `text-[11px]`/`text-xs`, body `text-sm`, card
  titles `text-base sm:text-lg`, hero title `text-3xl sm:text-4xl`. Sentence
  case, no all-caps labels.
- **Icons:** inline SVG, outline style, `strokeWidth` 1.6–1.8,
  `aria-hidden="true"`, sized `h-3.5 w-3.5` to `h-6 w-6`.
- **Radius:** `rounded-xl` for controls and buttons, `rounded-2xl` for
  cards and panels, `rounded-full` for chips and dots.

## Signature patterns

**Navy hero panel (one per page, at the top):** implemented by
`WorkspaceHeader` in `src/components/attendance/WorkspaceUi.jsx` — dot pattern,
eyebrow `text-xs text-white/60`, serif white title, `text-white/70`
description, optional actions and a status row. Buttons on the hero use
`heroPrimary` (white) and `heroSecondary` (white outline). Status chip on navy:
`rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white`.

**Controls (inputs/selects):** `StaffUi.jsx` `inputClass` — white with a
clearly visible `border-slate-400` and `placeholder:text-slate-500`,
`focus:border-[#3B4A86] focus:ring-2 focus:ring-[#3B4A86]/15`. Never a faint
slate-200 hairline — elderly users must see the field.

**Section heading with navy bar:**
`<h3 className="flex items-center gap-2 text-sm font-semibold text-[#0B1330]"><span aria-hidden className="h-4 w-1 rounded-full bg-[#0B1330]" />Title</h3>`

**Card:** `relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 pt-5 shadow-[0_1px_2px_rgba(11,19,48,0.05)] transition-colors hover:border-[#3B4A86]/40`
with a short navy tab `absolute left-0 top-0 h-[3px] w-14 bg-[#0B1330]`.

**Chip:** `inline-flex rounded-full bg-[#F0EDFA] px-2.5 py-0.5 text-[10px] font-semibold text-[#3B4A86]`.

**Field tile (read-only details):** `rounded-xl bg-[#F7F6FB] px-3.5 py-3` with
a `text-[11px] text-slate-500` label and `text-sm font-medium text-[#0B1330]`
value; empty values show "Not recorded" in `text-slate-400 font-normal`.

**Buttons:** `heroPrimary` / `heroSecondary` (on navy) and `buttonClass` /
`secondaryButton` / `tableButton` (on white) in the shared UI files. On light
backgrounds a button is **never pure white**: secondary/table/page buttons and
inactive tabs use `border-slate-400 bg-slate-100 text-slate-700`, hover
`bg-slate-200`. Pure-white buttons are reserved for navy surfaces
(`heroPrimary`), where they stand out.

**Status pill with dot:** implemented by `StatusBadge` — dot + label,
emerald-50/800 (success), amber-50/800 (warning), slate-100/600 (neutral),
red-50/700 (danger), lavender/indigo (neutral).

**Pagination:** Previous/Next as secondary buttons; the current page is
`grid h-9 min-w-9 place-items-center rounded-xl bg-[#0B1330] px-3 text-xs font-semibold text-white`
with `aria-current="page"`.

**Empty state:** dashed slate-200 border panel on `bg-[#F7F6FB]/60`, a
`h-12 w-12 rounded-full bg-[#F0EDFA] text-[#3B4A86]` icon badge, a
`font-serif text-xl font-bold` heading, one muted sentence, and a clear/reset
action when one exists.

**Loading state:** skeleton blocks from `src/components/ui/Skeleton.jsx`
(`Skeleton`, `SkeletonCards`, `SkeletonRows`) — `bg-[#F0EDFA]` and slate-100
with `animate-pulse motion-reduce:animate-none`. Match the shape of the real
content; max about 6 skeleton cards.

**Book cover:** always use the shared `<BookCover book={book} className="h-28 w-20 shadow-sm" />`.

## Page layout templates

- **Browse/list page:** navy hero (title + search) → white filter card
  ("Refine results") → results toolbar (status dot + count, sort, refresh) →
  responsive card grid (`grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4`) →
  pagination bar with `border-t border-slate-200`.
- **Detail view / dialog:** navy hero (cover, format chip, serif title, author,
  section, primary action in white) → grouped sections with navy-bar headings
  → tile grid (`grid-cols-1 sm:grid-cols-2 gap-2.5`) → list/table section →
  pagination.
- **Edit/form dialog:** navy "You're editing" strip → grouped field sections in
  a 2-column grid (`sm:grid-cols-2 gap-4`, wide fields `sm:col-span-2`) →
  sticky footer with Cancel + Save.
- **Dashboard/stats page:** navy hero with the page title and role chip → stat
  cards (white card pattern, big serif number, small muted label) → one or two
  content cards. Keep a single navy block per page.

## Quality and optimization rules

- **One navy block per page.** Everything else stays white with navy used
  sparingly (buttons, active states, heading bars).
- **Performance:** CSS-only decoration. No blur/backdrop-filter, no large box
  shadows, no JS animation. Only `transition-colors` on hover. Add
  `[content-visibility:auto] [contain-intrinsic-size:auto_260px]` to repeated
  card `<li>`s. Images use `loading="lazy" decoding="async"`.
- **Accessibility:** semantic headings (one `h1`), `aria-label` on selects
  without visible labels, `role="status"` for loading/count text, `role="alert"`
  for errors, `aria-busy` on result containers, `sr-only` text for icon-only or
  repeated buttons, visible `focus-visible` outlines, `aria-current="page"` on
  the active page, respect `motion-reduce`.
- **Responsive:** mobile-first, truncate or `line-clamp-*` long titles,
  `break-words` on user data, `min-w-0` on flex children.
- **Data states:** always handle loading, error (with retry), and empty. Show
  "Not recorded" instead of blank values.
- **Consistency:** reuse the same component patterns across pages. Don't create
  a new style for something that already has a pattern above.

## Modals and dialogs

Never hand-build a modal. Always use the shared `Modal`
(`src/components/ui/Modal.jsx`) and its wrappers (`CatalogDialog`,
`ActionDialog` for `useDialog` confirms). There is **one modal design** —
every window uses the same navy gradient header and the same footer bar.

- **Props:** `title`, `description`, `icon` (outline SVG), `size`
  (`sm` | `md` | `lg` | `xl`), `busy`, `onClose`, `footer`, `children`.
- **Header (same everywhere):** gradient `bg-gradient-to-br from-[#0B1330]
  via-[#17214A] to-[#3B4A86]` with the dot pattern, white serif title,
  `text-white/85` description, icon badge in `bg-white/10 text-white`, and
  the ✕ close button. Never a plain white header.
- **Body:** scrolls inside the dialog; a soft `#F7F6FB` to white tint fades
  in over the top 140px only. Body padding is `p-5 sm:p-6`. A book's identity
  (cover, title, author) is a **light panel** (`border-slate-200
  bg-[#F7F6FB]`) at the top of the body — never a second navy block.
- **Footer (same everywhere):** pass actions through the `footer` prop —
  `border-t border-slate-200 bg-gradient-to-r from-[#F7F6FB] to-white
  px-5 py-4 sm:px-6`. Dismiss actions (Close/Done/Cancel) use
  `secondaryButton`; the primary action is navy (`buttonClass`); destructive
  confirms are red. Forms whose submit button lives inside the form use a
  **sticky in-form bar with the exact same classes** (`sticky bottom-0` +
  negative margins to bleed to the edges, `-mx-5 -mb-5 sm:-mx-6 sm:-mb-6`).
  Pagination-only bottoms (e.g. inventory history) also pass through the
  `footer` prop so every window ends in the same bar.
- **Mobile:** dialogs become bottom sheets (`rounded-t-3xl`), centered cards
  from `sm` up.
- **Danger:** destructive confirms keep the same shell; only the icon badge
  and confirm button turn red.
- **Behavior is built in:** Escape and backdrop click close (blocked while
  `busy`), body scroll lock, focus moves into the dialog and returns on
  close, Tab stays inside. Don't re-implement it.
- **Performance:** gradients are static CSS only. No backdrop blur, no
  animated entrances, no extra shadows.

Implementation notes (local): the shared `Modal` keeps two small extra
options used by existing flows — `dismissOnBackdrop` (default true; forms
can block accidental dismissal) and `iconClassName` (colours the header icon
badge, used by the confirm variants).

## Linear-inspired refinements

The member pages adopt Linear's crisp craft on top of the LIRC palette
(extracted with `skillui` — see `docs/design-references/linear-aesthetic.md`):

- **Surfaces:** every card, panel and hero keeps the identity's 16px radius
  (`rounded-2xl`) with a hairline `border-slate-200`; controls stay
  `rounded-xl`.
- **Shadow scale** (subtle, static CSS only):
  - Cards / panels / stat cards: `shadow-[0_1px_2px_rgba(11,19,48,0.05)]`
  - Floating (dropdowns, toasts): `shadow-[0_4px_12px_rgba(11,19,48,0.12)]`
  - Modals: `shadow-[0_8px_32px_rgba(11,19,48,0.2)]`
  - Heroes stay flat (no shadow).
- **Hairlines over heavy borders:** toasts use a 1px border; dividers stay
  `divide-slate-100`; no zebra striping.
- **Compact headers:** panel headers use `px-5 py-4`.
- **Hover shifts:** interactive rows/cards change background or border color
  only (`transition-colors`), never lift or scale.
