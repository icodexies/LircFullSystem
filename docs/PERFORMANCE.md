# Performance audit — 22 Oct 2026

Scope: React 19 + Vite 8 + Supabase (3.0k books, 10k members, 4.7k visits, 35 loans).
Method: production builds of `09f98a5` (before) and `00bc77b` (after), served
side by side; browser resource/request timings; SQL `EXPLAIN (ANALYZE, BUFFERS)`
and `clock_timestamp()` on the live database; rollback-isolated old/new function
comparisons.

## Measured results

### Member search (the only High-impact issue)

| Measurement | Before | After |
| --- | --- | --- |
| `EXPLAIN` fast name predicate (`hernandez`) | Seq Scan **105.6 ms**; `person_name()` called 9,983× | Seq Scan **17.1 ms**; no per-row function |
| `EXPLAIN` typo fallback (`villanueba`) | Seq Scan **75.8 ms** | Bitmap Index Scan **1.3 ms** |
| Full RPC, admin | 94–174 ms | 16–19 ms |
| Full RPC, librarian | 94–165 ms | 16–17 ms |
| Full RPC, staff | 93–163 ms | 16–18 ms (first call 51 ms cold) |
| Student / non-operator | blocked `42501` | blocked `42501` |

The trigram index is used by the typo fallback. The multi-word fast path is a
sequential scan at 10k rows (cheaper than the index for that shape); its 6× win
comes from the stored `search_name`, not from an index scan. At larger sizes the
planner can use the index for the single-pattern shape.

Result parity across 18 sample queries: **15/18 identical set and order**.
The 3 differences are dotted-initial queries the old code handled poorly:

| Query | Old | New |
| --- | --- | --- |
| `D. VILLANUEVA` | 2 | **7** (all Villanuevas with middle initial D) |
| `villanueva, d.` | 2 | **7** |
| `D.Villanueva` | 10 (fuzzy noise) | **7** |

Case changes (`hernandez`/`HERNANDEZ`), word order, extra spaces, card lookup
(`LIB-0008`) and the typo `villanueba`/`VILLANUEBA` are identical. `sma
villanueba` and `delacruz` return 0 in both versions (no word-splitting/space-
insensitive fuzzy match; the client-side per-word fallback is separate).

### Shared caches / background work

| Measurement | Before | After |
| --- | --- | --- |
| Settings RPCs, fresh load + two borrow dialogs | 2 (178 ms + 261 ms) | **1** (second dialog 0; 261 ms saved) |
| Catalog lookups, OPAC remount via SPA | 2 (226 ms + 236 ms) | **0** (462 ms saved) |
| Notification feed, 50 s hidden tab | 2 (1.1 s, 46.1 s) | **0** |
| Route prefetch, hover then click Inventory | no chunk; click→h1 **63 ms** | 7.3 KB chunk in 33 ms; click→h1 **29 ms** |
| `findPossibleBooks` (ISBN + title, live DB, 6 runs) | median **425 ms** | median **264 ms** (161 ms saved) |

### Bundle and page load

| Measurement | Before | After |
| --- | --- | --- |
| Entry `index-*.js` | 67.7 KB raw / 18.4 KB gzip | 67.6 KB raw / 18.4 KB gzip |
| MemberLayout | 43.6 KB / 11.8 KB | 43.9 KB / 11.9 KB |
| Total JS (sum of chunks) | 2,831.0 KB / 823 KB gzip | 2,831.5 KB / 823 KB gzip |
| CSS total | 122.6 KB | 122.6 KB |
| Public home JS (compressed, loaded) | 153 KB | 153 KB |
| Public home hero (loaded initially) | 263 KB (BG1-1200 + BG1-800) | 263 KB |
| Member cold-load API requests (hidden) | 7 | **6** (notification fetch skipped) |
| Member cold-load DCL / load | 183 / 185 ms | 197 / 199 ms |
| Public home DCL / load | 338 / 339 ms | 291 / 292 ms |

The public-home difference is within cache/warm-up noise and is not attributed
to the changes. The bundle grew by 0.5 KB raw / 0 KB gzip. The only page-load
request reduction is the hidden-tab notification fetch (7→6); no wall-clock
page-load speedup is claimed. LCP could not be measured in this hidden-tab
harness; the hero priority change is DOM-verified only (non-active images are
`fetchpriority="low"` vs `"auto"`), and the initially loaded hero bytes are
unchanged at 263 KB.

### RLS helper

`lirc_private.can_edit_catalog()` now uses `(select auth.uid())`. Permissions were
verified unchanged (staff false; librarian/admin true). **No standalone timing
gain is claimed** — this is a best-practice change; the remaining own-row RLS
policies are not on a hot multi-row path.

## Changes

1. `20261022100000_member_search_index.sql` — stored `search_name`, trigram GIN
   index, rewritten lookup.
2. `20261022102000_member_search_punctuation_space.sql` — punctuation is a word
   separator (`D.Villanueva` now works like `D. VILLANUEVA`).
3. `20261022101000_wrap_auth_uid_catalog.sql` — RLS helper best practice.
4. `src/services/fines/finesService.js` — 60 s settings cache, in-flight dedupe,
   cleared on save; Settings page reads fresh.
5. `src/services/catalog/bookService.js` — 5 min formats/shelves cache; ISBN and
   title duplicate checks run in parallel.
6. `src/context/notifications/NotificationProvider.jsx` — poll only while visible,
   refresh on return, abort on unmount.
7. `src/routes/memberScreens.js` + `MemberSidebar.jsx` — hover/focus route
   prefetch.
8. `src/components/home/HeroSection.jsx` — active hero high priority, others low.

## Already efficient (unchanged)

- No `select('*')`; only used columns selected. `.select()` without columns remains
  on three single-row attendance/enrollment mutations — negligible.
- No N+1 loops; heavy reads are RPCs/joins; every list is server-paginated.
- Filters/sorts/search run in Postgres; the only client ranking is ≤10 rows.
- One Supabase client, lazily imported (though the public home still fetches the
  Supabase chunk for the auth-session check — 53 KB compressed).
- Lazy routes, vendor splitting, dynamic Excel/PDF (908 KB / 585 KB never load
  unless exporting), WebP/srcset images, skeletons, abort cleanup, error states.
- No realtime subscriptions. Indexes already cover loans, attendance,
  notifications, activity, curriculum and catalog trigram searches.

## Not applied

- **TanStack Query**: npm registry access is blocked on this machine (certificate
  / 403); the two shared reads are deduplicated with TTL caches instead. When
  available: `staleTime` 60 s, `gcTime` 15 min, `refetchOnWindowFocus: false`.
- **RLS own-row policies** (usersData, avatar storage): wrap `auth.uid()` in the
  policy as `(select auth.uid())` when those policies are next edited.
- **Cover images**: current OPAC page made 0 third-party cover requests; storing
  covers in Supabase Storage remains the long-term fix.
- **Virtualisation**: not needed at 20–24 rows/page.

## How to verify

- Search: `EXPLAIN (ANALYZE, BUFFERS)` on the `search_name` predicate; expect a
  Seq Scan ~17 ms (or Bitmap Index Scan at larger sizes) and the typo operator
  `%>` using `usersdata_search_name_trgm`. Time `lirc_member_lookup('hernandez')`
  as staff (expect 16–18 ms warm).
- Settings: Network filter `lirc_settings_get`; two dialogs within 60 s → one call.
- Lookups: Network filter `book_formats`/`shelves`; leave and return to OPAC within
  5 min → zero new calls.
- Notifications: hide the tab for 50 s → zero `lirc_notification_feed` requests;
  show it → one refresh.
- Prefetch: Network on hover over a sidebar page → its chunk loads before click.
- Bundle: `npm run build`; entry 18.4 KB gzip, total 823 KB gzip across all chunks.
- Page load: Lighthouse on https://ccc-lirc.vercel.app (mobile); compare LCP/CLS/TBT.
  Do not use `npm run dev` for request counts — StrictMode double-invokes effects.
