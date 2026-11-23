# Load Resilience Plan - 6,000-User Readiness

This plan addresses the client-side request storm found during the 6,000-user load test. It also identifies the backend work that the client cannot compensate for.

> **Implementation status - 2026-11-23:** the first release is implemented locally.
> Delivered: bounded browser request timeout, shared `readCache`, semester cache/focus
> debounce, unread-count notification polling with jitter/backoff, stale OPAC results,
> Path Finder program/curriculum cache, a single `lirc_my_dashboard` RPC, and an OPAC
> export lock. New RPC migration `20261123110000_load_resilience_rpcs` is applied and
> recorded. Still pending: workspace-bootstrap RPC, broader page caches, statistics
> page cache, server-side export job, Supabase compute upgrade, and distributed staging
> load test. The frontend is deployed at https://ccc-lirc.vercel.app (commit `5acdc93`,
> deployment `dpl_4AzpXfEa748pdAZWxZcnetaTDVwD`); the RPC migration is applied and recorded.

## 1. Test findings that drive the plan

- The aggressive 6,000-VU test reached 6,000 virtual users for 4 minutes 30 seconds.
- Result: **88.74% failed requests**, 52,133 failures out of 58,742 requests.
- Page operations reached **2-4 minute p95 waits**.
- The production database **restarted** during the run. It recovered and the live app returned HTTP 200.
- The database reported **60 maximum connections** and only 18-23 in use during the test, so the first failure was at the API/client/network edge, not a simple database CPU exhaustion.
- A 50-user pilot completed with **zero failed requests**.
- Normal page data loads were roughly **1.1-1.4 seconds** before the stress test.

A single Windows machine running 6,000 VUs is not a perfect model of 6,000 real browsers, but it exposed the request amplification and poor degradation behavior in the client.

## 2. Goals

### Must-have

- 6,000 authenticated sessions with normal 30-60 second interaction pacing.
- No database restart or sustained API outage.
- No unbounded retry or polling storms.
- Page-level failure states instead of endless "Loading...".
- Shared requests are not duplicated by multiple components.
- Cache invalidation is explicit and safe.

### Provisional acceptance targets after backend scaling

| Scenario | Target |
| --- | --- |
| 6,000 logged-in users, 30-60s think time | <0.5% failed requests; no restart |
| API p95 under that load | <1.5s |
| Navigation p95 under that load | <3s |
| 1,000 actively navigating users, 5-10s think time | <1% failures; p95 API <2s |
| Notification latency | <2 minutes |
| Database connections | <70% of configured maximum |
| Client-side duplicated bootstrap requests | At most one per app boot |

The current client cannot guarantee these targets alone. The Supabase compute/connection tier must be raised and the test must be run from distributed clients against a staging project.

## 3. Workstream A - Client request reduction (P0)

### A1. Replace full notification polling with unread-count polling

**Files**

- `src/context/notifications/NotificationProvider.jsx`
- `src/services/notifications/notificationService.js`
- `supabase/migrations/` (new RPC)
- `docs/NOTIFICATIONS.md`

**Current behavior**

Every visible member tab fetches the full notification feed every 45 seconds. At 6,000 tabs that is about **133 full-feed requests per second**.

**Implementation**

- Add `lirc_notification_unread()` returning only the unread count and latest timestamp.
- Poll the unread count every 90-120 seconds with random jitter.
- Load the full feed only when the bell is opened or the count changes.
- Pause polling while hidden; resume after a short random delay.
- Replace `setInterval` with a recursive timeout so a slow request cannot overlap the next poll.
- Back off after failures: 2m, 5m, 10m, capped, with jitter.
- Keep the last known unread count while revalidating.

**Fallback**

If the new RPC is unavailable, use the existing feed RPC at a longer interval. Do not break older databases.

**Tests**

- Provider unit test for interval, visibility pause and backoff.
- Manual bell test.
- Verify no overlapping requests.

### A2. Cache the semester list and debounce focus refreshes

**File**

- `src/context/periods/SemesterProvider.jsx`
- `src/services/periods/periodService.js`

**Current behavior**

The semester list reloads every time the window regains focus. A room full of tabs opened or refocused together creates a synchronized request burst.

**Implementation**

- Add a 5-minute in-memory cache for the semester list.
- On focus, refresh only if the cache is stale.
- Debounce focus events by 500-1000ms.
- Add jitter to any scheduled refresh.
- Keep the current selection and last known list while refreshing.

**Tests**

- Rapid focus events cause at most one request.
- Cache expires correctly.
- Semester switch still updates all dependent pages.

### A3. Add a shared cache and in-flight request deduplication

**New file**

- `src/services/shared/requestCache.js`

**Use for**

- profile;
- semesters;
- announcement feed (one per session already, but make it explicit);
- stable reference data;
- page-level read results where freshness permits.

**Rules**

- Cache keys must include the user ID and semester where applicable.
- Clear caches on logout and user switch.
- Shared promises must **not** be tied to one caller's `AbortSignal`.
- Callers may ignore the result after unmount, but must not abort a shared request used by other components.
- Add TTLs by data type:
  - semester list: 5 minutes;
  - profile: until explicit profile refresh;
  - announcements: 5 minutes;
  - catalog lookups: existing cache retained;
  - page data: short TTL or stale-while-revalidate where safe.

### A4. Add a request timeout, bounded retry and circuit breaker

**New file**

- `src/services/shared/request.js`

**Current behavior**

A slow Supabase request can remain pending until the browser or API edge times out. That produces long "Loading..." screens and retry pressure.

**Implementation**

- Wrap read calls with a 10-15 second timeout.
- Retry only idempotent reads, at most once or twice.
- Use exponential backoff with jitter.
- Do not retry writes, transfers or exports automatically.
- Stop background polling after repeated failures.
- Return a structured `BusyError` / `TimeoutError` the UI can display.
- Provide a visible "Server busy" notice and a Retry button.

### A5. Reduce duplicate dashboard requests

**File**

- `src/pages/PrivatePages/Dashboard/Dashboard.jsx`
- `src/services/borrow/borrowService.js`
- `src/services/statistics/statisticsService.js`
- `src/services/fines/finesService.js`

**Current behavior**

The dashboard requests open loans and all-loan summary separately, plus statistics and fines. At 6,000 users, those small calls multiply into a large burst.

**Implementation**

- Add one read-only `lirc_my_dashboard()` RPC returning:
  - open-loan totals and rows;
  - all-loan summary count;
  - personal statistics needed by the cards;
  - fine summary.
- Keep the individual RPCs available as fallbacks.
- Make the dashboard payload small; do not include unrelated records.
- Measure response size and query plan before accepting the RPC.

## 4. Workstream B - Workspace bootstrap consolidation (P1)

**Files**

- `src/context/auth/AuthContext.jsx`
- `src/context/periods/SemesterProvider.jsx`
- `src/context/notifications/NotificationProvider.jsx`
- `src/components/announcements/AnnouncementPopup.jsx`
- `src/services/auth/authService.js`
- new migration for `lirc_workspace_bootstrap()`

**Current behavior**

A full app reload can request the profile, semesters, notifications and announcements separately before the route page starts its own requests.

**Implementation**

- Add one read-only `lirc_workspace_bootstrap()` RPC returning:
  - own profile summary;
  - active/available semester list;
  - unread notification count;
  - active announcements;
  - optional settings such as fines-enabled.
- Use it once per app boot.
- Keep the existing RPCs as fallback.
- Do not include heavy page data in this bootstrap.
- The client should still load the full notification feed only when the bell is opened.

**Security**

- `SECURITY DEFINER` with `search_path = ''`.
- Derive the caller from `auth.uid()` or the existing profile helper; never accept a profile ID from the client.
- Return only the caller's own profile data.
- Add an authenticated-only execute grant.
- No service-role key in the browser.

## 5. Workstream C - Page-specific improvements

### C1. Path Finder

**Files**

- `src/hooks/pathfinder/usePathFinder.js`
- `src/services/pathfinder/pathFinderService.js`

**Current behavior**

Path Finder loads the complete selected program curriculum, including all subjects and recommended books, on each visit. The baseline call was about 1.5 seconds.

**Implementation**

- Cache curriculum by `program_id` for the current session.
- Keep the last curriculum visible while revalidating.
- Refresh manually through the existing button; do not refetch on every mount.
- Load one program at a time; never preload all curricula.
- Add a lightweight version/updated-at check if the data changes frequently.
- Consider lazy-loading by year level or expanding only selected subjects if the payload grows.

### C2. OPAC

**Files**

- `src/hooks/catalog/useCatalog.js`
- `src/pages/PrivatePages/OPAC/OPAC.jsx`
- `src/services/catalog/bookService.js`

**Current behavior**

OPAC hides the current results while loading and requests books plus format/section lookups. Lookups are already cached, but the last filtered page is not.

**Implementation**

- Keep the previous book rows visible with an "Updating..." state instead of clearing the list.
- Cache the last successful filter/page result for a short period.
- Deduplicate identical in-flight book queries.
- Prefetch only the next page when the user is near the page control.
- Reduce the card payload to fields actually displayed.
- Keep the existing server-side pagination, debounce and abort behavior.
- Do not turn the catalog into a full download-and-filter list.

### C3. Statistics

**Files**

- `src/pages/PrivatePages/Statistics/Statistics.jsx`
- `src/components/statistics/`
- `src/hooks/statistics/useStatisticsDetail.js`

**Implementation**

- Load only the selected statistics tab.
- Cache the current semester's card data for a short interval.
- Keep previous cards visible while refreshing.
- Do not fetch operator-only statistics on member pages.
- Avoid automatically loading every detail RPC at once.

### C4. My Borrowing and profile

**Files**

- `src/pages/PrivatePages/MyBorrowing/MyBorrowing.jsx`
- `src/pages/PrivatePages/Profile/Profile.jsx`
- `src/services/borrow/borrowService.js`
- `src/services/borrow/reservationService.js`
- `src/services/validation/onlineValidationService.js`

**Implementation**

- Keep loans, fines, reservations and validation requests in one page-level loader where possible.
- Avoid duplicate calls already made by the member layout.
- Cache the page result for the current session.
- Use one canonical loading/error state per page.

## 6. Workstream D - Export controls (P1)

**Files**

- `src/pages/PrivatePages/OPAC/OPAC.jsx`
- `src/services/catalog/bookService.js`
- `src/services/catalog/bookCardDocx.js`
- `src/services/attendance/attendanceExportJob.js`
- `src/services/borrow/borrowExportJob.js`

**Problem**

The OPAC export can request the entire filtered catalog in 1,000-row batches, four at a time. Hundreds of simultaneous export clicks would create a huge read surge. Large Excel/PDF exports also consume the user's browser CPU.

**Implementation**

- Allow only one export at a time per browser.
- Require confirmation for large exports.
- Add a short cooldown after an export.
- Show a clear "preparing" state.
- Keep attendance/borrow exports in their existing background jobs.
- If exports are common at scale, move catalog exports to a server-side job and return a download link.
- Do not auto-retry exports.

## 7. Workstream E - Client resilience UX

### Loading and errors

- Show page-level loading only for the first load.
- Keep old data with an "Updating..." state during revalidation.
- After timeout, show a Retry button and a human-readable message.
- Do not leave an infinite skeleton.
- Disable repeated submit buttons and export buttons while busy.

### Network behavior

- Pause polling when hidden; resume with jitter.
- Pause background work when offline and resume on `online`.
- Use page visibility plus a random delay to prevent synchronized resume.
- Do not retry a request automatically when the user explicitly cancelled.

### Cache invalidation

- Clear user-specific caches on logout and user switch.
- Invalidate semester-dependent caches when the semester changes.
- Invalidate catalog caches after book edits.
- Invalidate notification data after mark-read or a new notification.
- Keep shared caches alive across route changes where safe.

## 8. Workstream F - Backend/platform prerequisites

These are non-negotiable for 6,000 active users.

1. Raise the Supabase compute tier and available connections. The current database reports only **60 total Postgres connections**.
2. Use Supabase's connection pooler/Supavisor for browser API traffic.
3. Add the unread-notification and workspace-bootstrap RPCs.
4. Add `lirc_my_dashboard()` and measure its query plan before use.
5. Review statistics query indexes and consider a read replica for heavy operator statistics.
6. Set a sensible statement timeout for API-facing RPCs.
7. Run the load test from distributed clients against a staging copy, not from one Windows machine against production.
8. For write testing, use dedicated staging accounts and clean up afterwards.

## 9. Implementation order

### Phase 1 - Safe client-only reductions

- Notification interval/visibility/backoff.
- Semester cache and focus debounce.
- Shared request timeout/backoff helper.
- Stale-while-revalidate for OPAC and Path Finder.
- Remove duplicate dashboard calls where possible without a schema change.
- Add loading/error/retry states.

**Expected effect:** lower request rate and less "frozen" behavior even before backend changes.

### Phase 2 - Add the read-only RPCs

- `lirc_notification_unread()`.
- `lirc_workspace_bootstrap()`.
- `lirc_my_dashboard()`.
- Client fallbacks to old endpoints.
- Add migrations, tests and `docs/DATABASE_SETUP_STATUS.md` entries.

### Phase 3 - Page-level caching and payload reduction

- Path Finder curriculum cache.
- OPAC last-page cache and smaller card payload.
- Statistics tab caching.
- Profile/My Borrowing consolidation.

### Phase 4 - Export and browser-cost controls

- Export lock/cooldown.
- Large-export confirmation.
- Optional server-side catalog export job.

### Phase 5 - Staging load validation

- Run 100, 500, 1,000, 3,000 and 6,000 VU ramps.
- Use realistic page mixes and think times.
- Measure p50/p95/p99, error rate, database connections, API restarts and navigation performance.
- Repeat from more than one client/region.
- Gate release on the acceptance targets in section 2.

## 10. Tests and verification

### Unit tests

- Notification scheduling, visibility, jitter and backoff.
- Semester cache TTL and focus debounce.
- Request timeout and retry policy.
- Cache invalidation on logout/semester/book edit.
- No shared promise aborts a second consumer.

### Integration tests

- Login -> dashboard -> OPAC -> statistics -> Path Finder -> My Borrowing -> profile.
- Bell unread count -> full feed -> mark read.
- Semester switch updates dependent data.
- Book edit invalidates catalog cache.
- Export lock prevents parallel exports.

### Load tests

- 6,000 logged-in sessions, 30-60s think time.
- 1,000 active navigation users, 5-10s think time.
- 6,000 notification-only sessions.
- Separate write test on staging: borrow, return, reservation, settings.
- Verify no database restart, no unbounded connection growth, no retry storm.

## 11. Rollout and rollback

- Deploy client changes in small batches.
- Keep old RPCs available for one release after the new bootstrap/dashboard RPCs are added.
- Feature-flag new polling/cache behavior if possible.
- If error rates rise, disable background polling and serve cached/stable data first.
- Roll back the client before rolling back an additive RPC migration.
- Do not run destructive load-test SQL against production.

## 12. Definition of done

- 6,000-session staging run meets the target table.
- No production database restart during a controlled staging test.
- Client has no duplicate bootstrap requests per app boot.
- Notification polling no longer fetches the full feed every 45 seconds.
- Navigation remains responsive with old data visible while refreshing.
- All changes are documented in `docs/CHANGE_LOG.md`; structural changes update `docs/PROJECT_MAP.md`, and new RPCs update `docs/DATABASE_SETUP_STATUS.md`.
