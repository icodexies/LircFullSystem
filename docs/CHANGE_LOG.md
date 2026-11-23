# Change Journal for Agents

This is the short external memory for recent changes. Add a new entry at the top for every task, including small fixes. Keep entries concise: no secrets, no full diffs.

The purpose is to let a new session answer "what changed here recently?" without rescanning the whole feature.

## Entry template

```markdown
## YYYY-MM-DD - Short title
- Area:
- Commit/state:
- Files:
- Behavior:
- Data/security:
- Verification:
- Map updated: yes/no
```

Use `Map updated: yes` only when a route, file location, data contract, role rule or flow changed.

## 2026-11-23 - Implement first load-resilience release

- Area: client request volume, dashboards, notifications, semester loading, Path Finder/OPAC loading and the first read-only RPCs.
- Commit/state: local code changes; migration `20261123110000_load_resilience_rpcs` applied and recorded in production. No frontend or Edge Function deployment yet.
- Files: `src/lib/supabase/client.js`, `src/context/notifications/NotificationProvider.jsx`, `src/services/notifications/notificationService.js`, `src/context/periods/SemesterProvider.jsx`, `src/services/periods/periodService.js`, `src/services/shared/readCache.js`, `src/services/pathfinder/pathFinderService.js`, `src/hooks/pathfinder/usePathFinder.js`, `src/hooks/catalog/useCatalog.js`, `src/pages/PrivatePages/OPAC/OPAC.jsx`, `src/services/dashboard/dashboardService.js`, `src/pages/PrivatePages/Dashboard/Dashboard.jsx`, `supabase/migrations/20261123110000_load_resilience_rpcs.sql`, `tests/shared/readCache.test.js`, `docs/PROJECT_MAP.md`, `docs/DATABASE_SETUP_STATUS.md`, `docs/LOAD_RESILIENCE_PLAN.md`.
- Behavior: browser requests now have a 20s deadline; notifications poll unread counts every ~105s with jitter/backoff instead of downloading the full feed every 45s; semester reads are cached/debounced; Path Finder programs/curricula are cached per session; OPAC keeps prior rows while refreshing; dashboard loads through one `lirc_my_dashboard` call; exports are guarded against concurrent runs.
- Data/security: added authenticated-only, read-only `lirc_notification_unread()` and `lirc_my_dashboard(bigint)`; both derive the caller profile and use `security definer` + `search_path=''`.
- Verification: lint passed, 139 tests passed, production build passed; local smoke tests for Dashboard, OPAC and Path Finder had no console errors; RPCs returned HTTP 200 for the sample student.
- Map updated: yes (baseline counts, dashboard/notification mappings, read-cache/test entries).

## 2026-11-23 - Plan 6,000-user load resilience

- Area: performance architecture and client request behavior.
- Commit/state: planning document only; no runtime, database or deployment changes.
- Files: `docs/LOAD_RESILIENCE_PLAN.md`, `docs/PERFORMANCE.md`.
- Behavior: defines phased client request reduction, workspace bootstrap/dashboard RPCs, stale-while-revalidate, export controls, resilience UX, staging load-test gates and rollback rules.
- Data/security: proposed new read-only RPCs require own-user scoping and authenticated-only grants; none created yet.
- Verification: based on the 6,000-VU production test and the documented request patterns in the client.
- Map updated: no (planning only).

## 2026-11-22 - Expand DCI Path Finder recommendations to 10 years

- Area: Path Finder recommendation data for the BSCS and BSIT curricula.
- Commit/state: migration created and applied to production; frontend and Edge Functions were not changed or deployed.
- Files: `supabase/migrations/20261122100000_dci_10_year_recommendations.sql`, `docs/DATABASE_SETUP_STATUS.md`, `docs/PROJECT_MAP.md`.
- Behavior: kept all 267 existing 2021-2024 approved links and added 303 approved links from 149 unique catalog books published 2016-2020. All 74 DCI course codes now have at least one pre-2021 title; combined coverage is 570 links across 261 books, 2016-2024.
- Data/security: additive approved recommendations owned by admin profile id 1; direct course-code links only, not Gen Ed group links. Migration recorded as `20261122100000`.
- Verification: database query confirms minimum year 2016, maximum 2024, 303 new-note rows, 149 new unique books, and zero DCI codes without a 2016-2020 title.
- Map updated: yes (migration count and Path Finder data reference).

## 2026-11-19 - Add persistent project map and agent workflow

- Area: developer workflow and documentation.
- Commit/state: new files, not yet committed or deployed.
- Files: `AGENTS.md`, `docs/PROJECT_MAP.md`, `docs/AGENT_WORKFLOW.md`, `docs/CHANGE_LOG.md`, `scripts/check-agent-docs.mjs`; pointer updates in `README.md`, `docs/FOLDER_STRUCTURE.md`, `docs/PROJECT_GUIDE.md`.
- Behavior: future work starts from the map and workflow instead of a full-project scan. Every change is journaled; structural changes also update the map.
- Data/security: no runtime, database or deployment change.
- Verification: full project inventory scan; `node scripts/check-agent-docs.mjs` checks links, mapped paths and route coverage.
- Map updated: yes (initial map).

## 2026-11-17 - OPAC Word cards, reliability fixes and statistics summary

- Area: OPAC export, attendance export, Settings/fines, statistics, AI recommendations.
- Commit/state: `4945ae0`; Vercel production deployment `dpl_8fFosVwjrBQwwTvNUwQPu8gMpEYw` is live. The Supabase `subject-recommendations` Edge Function was **not** deployed.
- Files: `src/pages/PrivatePages/OPAC/OPAC.jsx`, `src/services/catalog/bookCardDocx.js`, `bookCardValidation.js`, `bookService.js`, `src/services/attendance/attendanceReportWorkbook.js`, `src/pages/PrivatePages/Settings/Settings.jsx`, `src/services/fines/finesService.js`, `supabase/functions/subject-recommendations/index.ts`, `supabase/migrations/20261117090000_statistics_overview_borrowers.sql`, `tests/catalog/bookCardValidation.test.js`.
- Behavior: filtered OPAC books download as A4 Word catalog cards; incomplete records show a review modal with View/Continue/Cancel; attendance Unique visitors rows are highlighted; the borrower statistics card reads its restored overview summary; the settings/fines abort race and OPAC lookup retry were fixed; AI uses the faster catalog-only default and a catalog fallback.
- Data/security: restored the `borrowers` summary to `lirc_statistics_overview`; the migration was applied and recorded in production. No secrets added.
- Verification: lint, 134 tests and production build passed; live Vercel asset served the new OPAC bundle.
- Map updated: yes (initial map created from this baseline).
