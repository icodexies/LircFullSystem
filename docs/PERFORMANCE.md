# Performance audit — 22 Oct 2026

Scope: React 19 + Vite 8 + Supabase (3.0k books, 10k members, 4.7k visits, 35 loans).
Method: production build inspection, Network/Performance resource timings in the
running app, SQL `clock_timestamp()` timings on the live database, and targeted
benchmarks of the new query shapes inside a rollback transaction.

## Measured before → after

| Area | Before | After |
| --- | --- | --- |
| Member search RPC (`lirc_member_lookup`) | **95 ms** per call | **16–31 ms** |
| Name predicate alone (`hernandez`, 10k rows) | 149 ms | **9 ms** |
| Typo fallback (`villanueba`) | 55 ms | **3 ms** |
| Fines settings on 3 dialog opens | 3 RPCs | **1 RPC** (60 s cache) |
| Catalog format/shelf lookups on remounts | 2 RPCs each time | **0** for 5 min |
| Notification feed while the tab is hidden | poll every 45 s | **paused**; refresh on return |
| Page chunk on first navigation | loaded on click | **prefetched on sidebar hover/focus** |
| Home hero images | 4 backgrounds, all default priority | active = high, others = low (~284 KB total) |

## Changes

1. **Indexed member search** — `supabase/migrations/20261022100000_member_search_index.sql`.
   A stored `search_name` (lowercase, punctuation-free) with a pg_trgm GIN index;
   `lirc_member_lookup` uses it for the fast path and the `%>` operator for the
   typo fallback. Results and word-order/middle-initial behaviour are unchanged;
   punctuation in the query is now ignored.
2. **Shared settings cache** — `src/services/fines/finesService.js` (60 s, in-flight
   dedupe, errors never cached, cleared by `setFinesSetting`; the Settings page
   always reads fresh).
3. **Catalog lookups cache** — `src/services/catalog/bookService.js` (5 min for
   formats/shelves; independent ISBN/title duplicate checks now run in parallel).
4. **Notification polling** — `src/context/notifications/NotificationProvider.jsx`
   only polls while visible and refreshes immediately when the tab returns; all
   loads share one abort controller.
5. **Route prefetch** — `src/routes/memberScreens.js` + `MemberSidebar.jsx` import
   the page chunk on hover/focus, so the Suspense screen is avoided on the click.
6. **Hero image priority** — `HeroSection.jsx` marks only the active background
   high priority.
7. **RLS helper** — `20261022101000_wrap_auth_uid_catalog.sql` wraps
   `(select auth.uid())` so the write policy is evaluated once per statement.

## Already efficient (no change)

- No `select('*')`; only columns used are selected. (`.select()` without arguments
  remains on three single-row attendance/enrollment mutations — negligible.)
- No N+1 loops; heavy reads are RPCs/joins, not per-row queries.
- Every list is server-paginated (`range`/RPC limits); no full-table loads.
- Filters, sorting and search run in Postgres; the only client ranking is the
  ≤10-row suggestion list.
- One Supabase client (`src/lib/supabase/client.js`), lazily imported.
- Routes are lazy and vendor chunks are split; exceljs (908 KB) and jsPDF
  (390 KB + html2canvas 195 KB) are dynamic imports.
- Images are WebP with `srcset`/`sizes`, lazy + async decode; covers fall back to
  Open Library only when a book has no local image.
- Skeletons/keyed loading states, abort controllers, empty/error states, and
  memoised contexts are already in place. No realtime subscriptions exist.
- Database indexes already cover loans, attendance, notifications, activity,
  curriculum, recommendations and catalog trigram searches; the only hot path
  missing one was the member name search (fixed).

## Not applied (and why)

- **TanStack Query**: the registry is blocked for this machine
  (`npm install` fails with certificate/403), and only two shared reads are
  duplicated. The focused TTL caches deliver the same dedupe without a new
  dependency. Adopt React Query when more shared server state appears and the
  registry is reachable (suggested: `staleTime` 60 s, `gcTime` 15 min).
- **RLS own-row policies** (`usersData` read policies, avatar storage): they use
  bare `auth.uid()` but touch only the caller's own row/object; wrapping them
  would be cosmetic at this scale. Suggested SQL if touched again:
  `using (user_id = (select auth.uid()))`.
- **Cover images**: the current OPAC page loaded no third-party covers (books
  without ISBNs use the local placeholder). Storing covers in Supabase Storage
  (as the home carousel already does) remains the best long-term fix.
- **Virtualisation**: lists are 20–24 rows per page; not needed.

## How to verify

- **Member search**: `EXPLAIN (ANALYZE, BUFFERS)` on
  `select * from public."usersData" where search_name like '%hernandez%';`
  should show a Bitmap Index Scan on `usersdata_search_name_trgm`. Time
  `select lirc_member_lookup('hernandez');` (expect 16–31 ms warm).
- **Caches**: DevTools → Network, filter `lirc_settings_get` / `book_formats`.
  Open the borrow dialog twice within a minute: one request. Reload /opac twice
  inside 5 min via SPA navigation: lookups fetched once.
- **Notifications**: hide the tab for >45 s; no `lirc_notification_feed` request
  appears until it is visible again.
- **Prefetch**: DevTools Network; hover a sidebar item — its page chunk loads
  before the click.
- **Bundle/loading**: Lighthouse on https://ccc-lirc.vercel.app (mobile preset),
  compare LCP/CLS/TBT; `npm run build` for chunk sizes.
- **React**: Profiler → record a route change; no unexpected repeated renders of
  the page shell or tables.
