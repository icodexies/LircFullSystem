# Performance audit — 22 Oct 2026

Scope: React 19 + Vite 8 + Supabase (3.0k books, 10k members, 4.7k visits, 35 loans).
Method: production builds of `09f98a5` (before) and `00bc77b` (after), served
side by side; browser Network Timing entries; SQL `EXPLAIN (ANALYZE, BUFFERS)`
and `clock_timestamp()` on the live database; rollback-isolated old/new function
comparisons; real UI flows for cache invalidation.

## Member search

### Plans and timings

| Measurement | Before | After |
| --- | --- | --- |
| `EXPLAIN` fast name predicate (`hernandez`) | Seq Scan **105.6 ms**; `person_name()` 9,983× | Seq Scan **17.1 ms**; stored column (no per-row function) |
| `EXPLAIN` typo fallback (`villanueba`) | Seq Scan **75.8 ms** | Bitmap Index Scan **1.3 ms** |
| Full RPC, admin (`hernandez` / `D. VILLANUEVA` / typo) | 104.5 / 99.5 / 163.8 ms | 16.2 / 17.5 / 17.6 ms* |
| Full RPC, librarian | 94.4 / 98.3 / 164.8 ms | 16.0 / 17.3 / 17.2 ms* |
| Full RPC, staff | 93.6 / 98.2 / 163.2 ms | 16.8 / **25.9** / 18.1 ms** |
| Student / non-operator | blocked `42501` | blocked `42501` |

\* before the word-start correction (7-result single-letter match).
\** final function: multi-letter names 16.8 ms; single-letter initials 25.9 ms;
typos 18.1 ms (staff, warm). The extra cost is the correct word-start check.

The trigram index is used by the typo fallback. The multi-word fast path is a
sequential scan at 10k rows; its win comes from the stored `search_name`, not an
index scan. At larger sizes the planner can use the index for single-pattern
shapes. Single alphanumeric letters use `LIKE` start-of-string/after-space;
longer words use literal `position()`.

### Result parity — 24 queries

**13 multi-letter queries are identical** (case, word order, spacing, card,
typos). **4 single-letter queries are corrected**, and **6 wildcard queries no
longer expand**.

| Query | Old | New | Reason |
| --- | ---: | ---: | --- |
| `d villanueva` | 7 | **4** | word-start/middle-initial only |
| `D. VILLANUEVA` | 2 | **4** | old missed middle initials stored without a period |
| `villanueva, d.` | 2 | **4** | same |
| `D.Villanueva` | 10 (fuzzy) | **4** | same |
| `%`, `_`, `%villanueva%`, `villanueva_`, `d%`, `_villanueva` | 10 each | **0 each** | `%`/`_` are literal, not LIKE wildcards |

The 4 `D. VILLANUEVA` rows: Sam D. (middle D), Danyca Alliah (first name starts
D, middle null), Keith Dustin N. (given name Dustin starts D, middle N), Vince
Andrei D. (middle D). Only 2 have middle initial D; the other 2 satisfy the
start-of-word rule. The original 7 included five matches *inside* words
(Benedict, Lenard, Endzley, etc.); those are gone.

Unchanged examples: `hernandez`/`HERNANDEZ` (10), `Hernandez Elmie` (1),
`ELMIE JOY` (1), `villanueba`/`VILLANUEBA` (10), `reyes maria` (1), `LIB-0008`
(1), `garma` (6), `sma villanueba` (0), `delacruz` (0), `ELMIE D HERNANDEZ` (1).

### Browser Network timings

Direct PostgREST calls from the production page, 5 runs each, hidden tab:

| Query | Old median | New median | Saved |
| --- | ---: | ---: | ---: |
| `hernandez` | **316 ms** | **220 ms** | 96 ms |
| `D. VILLANUEVA` | **307 ms** | **205 ms** | 102 ms |
| `villanueba` | **409 ms** | **205 ms** | 204 ms |

Resource-timing medians (Network panel duration, excluding fetch parsing):
~318→261 ms, ~305→202 ms, ~383→201 ms. The network RTT dominates; the DB
difference still shows end to end.

## Shared caches, background work, UI proof

| Measurement | Before | After |
| --- | --- | --- |
| Settings RPCs, fresh load + two borrow dialogs | 2 (178 + 261 ms) | **1** (second dialog 0; 261 ms saved) |
| Settings invalidation: rate 5→7 via Settings UI | — | next dialog made a **new 145 ms request**; accruing fine **₱9,850 → ₱13,790** immediately, then restored to ₱5 |
| Catalog lookups, OPAC SPA remount | 2 (226 + 236 ms) | **0** (462 ms saved) |
| Book edit: shelf → General Circulation, edition → PERF-TEST | — | visible immediately in Book details; restored to shelf 7 / edition null. Book rows are not cached; the lookup cache only holds filter options |
| Notification feed, 50 s hidden | 2 (1.1 s, 46.1 s) | **0** |
| Visibility event (simulated while hidden) | — | **1 feed request 1 ms after the event**, 282 ms; **0 extra** when hidden again |
| Route prefetch, hover then click Inventory | no chunk; click→h1 **63 ms** | 7.3 KB chunk in 33 ms; click→h1 **29 ms** |
| `findPossibleBooks` (ISBN + title, live DB, 6 runs) | median **425 ms** | median **264 ms** (161 ms saved) |

## Bundle and page load

| Measurement | Before | After |
| --- | --- | --- |
| Entry `index-*.js` | 67.7 KB raw / 18.4 KB gzip | 67.6 KB raw / 18.4 KB gzip |
| MemberLayout | 43.6 KB / 11.8 KB | 43.9 KB / 11.9 KB |
| Total JS (sum of chunks) | 2,831.0 KB / 823 KB gzip | 2,831.5 KB / 823 KB gzip |
| CSS total | 122.6 KB | 122.6 KB |
| Public home JS (compressed, loaded) | 153 KB | 153 KB |
| Public home hero (loaded initially) | 263 KB | 263 KB |
| Member cold-load API requests (hidden) | 7 | **6** (notification fetch skipped) |
| Member cold-load DCL / load | 183 / 185 ms | 197 / 199 ms |
| Public home DCL / load | 338 / 339 ms | 291 / 292 ms |

No wall-clock page-load speedup is claimed: the public-home delta is cache/noise;
the member page is slightly slower in this run. The only cold-load request
reduction is the hidden-tab notification fetch. LCP could not be measured in the
hidden harness; the hero priority change is DOM-verified only.

**Top 5 JS chunks** (full report: `docs/bundle-report.html`):

| # | Chunk | Raw / gzip | Loaded | Contents |
| --- | --- | ---: | --- | --- |
| 1 | exceljs.min | 907.8 / 249.8 KB | lazy | ExcelJS spreadsheet export |
| 2 | jspdf.es.min | 389.7 / 124.6 KB | lazy | jsPDF PDF export |
| 3 | react-vendor | 213.7 / 66.0 KB | initial | React, ReactDOM, scheduler |
| 4 | supabase-vendor | 209.2 / 53.3 KB | initial/auth | supabase-js (auth, postgrest, realtime, storage) |
| 5 | html2canvas | 194.8 / 45.0 KB | lazy | DOM→canvas for PDF |

The two largest chunks are never on a page load; they load only when an export
starts. The standard Rollup visualizer is unavailable (npm registry blocked), so
the report is a self-contained treemap from the actual build bytes.

## Database/audit items

- **`select('*')`:** none in `src`. Four no-argument `.select()` calls remain on
  single-row mutations/reads: `periodService.js:43`, `attendanceService.js:51,64,83`.
  They return the full row; negligible at one row.
- **N+1:** none found. Direct `.from()` calls are single queries; no `.map(async)`
  / `forEach(async)` database loops. Per-row counts inside `lirc_member_lookup`
  are SQL subqueries, not network N+1.
- **`book_loans` partial index:** it was **missing**. Added
  `loans_open_profile_idx ON book_loans (user_profile_id) WHERE returned_at IS NULL`
  (`20261022106000`). At 35 rows the planner still chooses a 0.15–0.20 ms Seq Scan;
  a forced `enable_seqscan=off` plan uses an Index Only Scan on the new index
  (1.495 ms). No current speedup claimed; the index is for scale.
- **RLS helper:** `can_edit_catalog()` uses `(select auth.uid())`; permissions
  verified (staff false, librarian/admin true). No standalone timing claim.
- **Realtime:** no subscriptions.
- **Supabase client:** one singleton, lazily imported (the public home still
  fetches the 53.3 KB Supabase chunk for the auth-session check).

## Credential check — 22 Oct 2026

Found and fixed in the working tree:

- `docs/DATABASE_SETUP_STATUS.md`: the **live admin password** was in the text;
  removed.
- `supabase/manual/sample_accounts.sql` and
  `supabase/manual/lirc_sample_staff_librarian_accounts.sql`: demo admin,
  librarian and staff passwords plus bcrypt hashes; replaced with `CHANGE_ME_*`
  placeholders.
- `.env.production`: tracked, containing the **public anon JWT**; untracked and
  now covered by `.gitignore` (kept locally). It is a public client key (JWT role
  `anon`), not a service key; it remains in the public bundle by design.
- Word docs: scanned; no passwords/tokens found.

**Current HEAD after the redaction commit:** no known plaintext passwords and no
JWT/secret token values in tracked files. **History still contains the old demo
passwords** (commits `6517f5c`, `35e9a6e`) and the public anon key (`8cdc4f9`).
Redaction does not rewrite history. **Rotate the live admin/librarian/staff
passwords now.** No service_role, Vercel, Gmail, or generated librarian password
was found in the repo or docs.

## Changes

1. `20261022100000_member_search_index.sql` — stored `search_name` + trigram GIN.
2. `20261022101000_wrap_auth_uid_catalog.sql` — RLS helper best practice.
3. `20261022102000_member_search_punctuation_space.sql` — punctuation separator.
4. `20261022103000_member_search_word_start_escape.sql` — word-start single
   letters; literal `%`/`_`; skip fuzzy for wildcard characters.
5. `20261022105000_member_search_single_letter_like.sql` — faster equivalent
   single-letter branch.
6. `20261022106000_loan_open_profile_index.sql` — partial open-loan index.
7. `src/services/fines/finesService.js` — 60 s settings cache, in-flight dedupe,
   cleared on save; Settings page reads fresh.
8. `src/services/catalog/bookService.js` — 5 min formats/shelves cache; parallel
   ISBN/title duplicate checks.
9. `src/context/notifications/NotificationProvider.jsx` — poll only while visible,
   refresh on return, abort on unmount.
10. `src/routes/memberScreens.js` + `MemberSidebar.jsx` — hover/focus prefetch.
11. `src/components/home/HeroSection.jsx` — active hero high priority.

## Already efficient (unchanged)

- No `select('*')`; no N+1; all lists server-paginated; filters/sorts/search in
  Postgres; one Supabase client; lazy routes; vendor splitting; dynamic Excel/PDF;
  WebP/srcset images; skeletons; abort cleanup; error states; no realtime.

## Not applied

- **TanStack Query**: npm registry blocked (certificate/403); TTL caches used.
  When available: `staleTime` 60 s, `gcTime` 15 min, `refetchOnWindowFocus: false`.
- **RLS own-row policies**: wrap `auth.uid()` in the policy when next edited.
- **Cover images**: 0 third-party requests measured; Supabase Storage remains the
  long-term fix.
- **Virtualisation**: not needed at 20–24 rows/page.

## How to verify

- Search: `EXPLAIN (ANALYZE, BUFFERS)` on the `search_name` predicate; the typo
  operator `%>` uses `usersdata_search_name_trgm`. Time
  `lirc_member_lookup('hernandez')` as staff (16.8 ms warm) and
  `('D. VILLANUEVA')` (25.9 ms).
- Settings: Network filter `lirc_settings_get`; two dialogs within 60 s → one call.
  Change the rate in Settings and reopen: a new request and the new amount.
- Lookups: leave/return to OPAC within 5 min → zero new `book_formats`/`shelves`.
- Notifications: hide for 50 s → zero feed requests; make visible → one request.
- Prefetch: Network on hover over a sidebar page → its chunk loads before click.
- Bundle: `npm run build`; open `docs/bundle-report.html`.
- Page load: Lighthouse on https://ccc-lirc.vercel.app (mobile); LCP/CLS/TBT.
  Do not use `npm run dev` for request counts — StrictMode double-invokes effects.
