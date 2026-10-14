# Live database setup status

Verified and completed on 9 October 2026 through the connected Supabase integration.

## Latest year-level correction

Migration `20261009115403_enrolled_year_levels_one_to_four.sql` was applied on 9 October 2026. New enrolled validations and student time-ins require a confirmed level 1–4. Card estimates outside 1–4 are unavailable. Old records are preserved for review, rather than automatically marked withdrawn or made fourth year.

Live read-only verification: **9,643** validation records; **7,687** in the validated count and **1,956** enrolled legacy records needing year-level review. Choose **Library validation → Advanced filters → Validation state → Needs year-level review** to find them. Confirm their actual level or status using school records. Historical checkout is still permitted. No student status, stored level, active semester or attendance row was rewritten by this correction.

The earlier setup audit below describes the state before this correction. All setup scripts are already applied; do not rerun the initial seed. See [filter explanations](FILTER_GUIDE.md) and [shared dialog usage](DIALOGS.md).

At the latest read-only check, the active semester is **2026-2027 · 2nd Semester**, dated **16 January–31 May 2027**. Its activation was last updated at 7:39 PM Philippine time on 9 October 2026, before this year-level migration. This work did not change it. Because its dates are in the future, new time-ins remain blocked even for valid students. If the school is currently in the first semester, use Academic periods → Make active on the correct semester after confirming the official calendar. Viewing the first semester in the header alone does not activate it.

Project: **lmsDatabase** (`jrrwhrnqembviaocrdmi`). The local app's `VITE_SUPABASE_URL` matches this project.

## What is already done

| Setup | Status |
| --- | --- |
| Base academic-period and attendance schema | Already applied; do not rerun |
| Library validation conversion | Already applied; `academic_year_id` and read-only legacy provenance exist |
| Initial 2026-2027 student validation | Already initialized; do not repeat |
| Academic years 2022-2023 through 2026-2027 | Five years and ten semesters exist |
| Active semester | 2026-2027 · 1st Semester |
| Attendance, enrollment and classification-options reporting functions | Already applied and verified with live read-only calls |
| Profile/attendance/enrollment RLS and triggers | Enabled; nonstaff read/report access checked in a rolled-back read-only transaction |
| Book-cover upload bucket and policies | Added in this setup session |
| Trigram search indexes for accession, title, author, ISBN and call number | Added in this setup session |

The initial 9,643 student enrollment records explicitly carry the one-time setup-assumption reference. They are not registrar verification. The existing school calendar dates remain provisional and were not changed.

## Change applied in this session

Migration `20261009112644_complete_catalog_storage_and_search.sql` is saved locally and recorded in the live migration history under `complete_catalog_storage_and_search`.

It creates the previously missing `book-covers` bucket, permitting public cover viewing and restricting new uploads to librarian/admin profiles. Uploads must be WebP and at most 524,288 bytes. Browser clients cannot overwrite/delete covers in this bucket. No image files were uploaded during verification.

It installs `pg_trgm` in the extensions schema and adds the five missing catalog contains-text indexes. No catalog/profile/enrollment/attendance records or period dates were edited.

The earlier setup scripts were applied manually and were absent from the migration-history table, even though their schema and functions exist. An empty/partial migration history is not evidence that setup is missing. Do not bulk rerun old scripts or blindly push the existing migration directory; a future CLI migration workflow needs its baseline reconciled first.

## Verified results

- Live annual report: 9,643 students, 9,643 initialized library validations, first page limited to 20 records, Next available.
- Live attendance report: zero visits, zero inside, zero unique visitors, no completed-duration average.
- Classification options: four departments, fifteen programs, three position classifications. Actual profile FK columns map to `departments`, `programs` and `position_classifications` with their `name` labels.
- Anonymous callers have no EXECUTE grant on the five staff scanner/period/report RPCs. An authenticated caller without a staff profile is rejected by report/options guards and cannot read profiles/enrollments/attendance through RLS.
- Unique annual-validation/open-visit indexes and attendance/enrollment triggers are present.
- Final counts match the pre-change audit: 9,991 profiles, 3,034 books, 6,259 physical copies, 9,643 library validations and zero attendance rows. Active semester remains unchanged.

These are database-level read checks and metadata verification, not a real scanner/device or production load test. No live attendance writes, student-status changes, account creation or bulk initialization were used as tests.

## What to do in the app

Your existing database setup does not need another SQL run for these features. Sign in with your admin account, then open Attendance, Library validation or Academic periods. Use the header for personal viewing; use the explicit Make active control only when the school changes the global transaction period. Confirm official calendar dates and correct exceptional student year levels using verified school records.

The detailed staff workflow remains in [ATTENDANCE.md](ATTENDANCE.md); cover/edit behavior is in [OPAC.md](OPAC.md). Their earlier local-only verification descriptions refer to implementation before this live setup session; this status note records the current live state.

## Existing advisor notices outside this setup change

Supabase's advisor still flags the authenticated SECURITY DEFINER entry points, which intentionally enforce the trusted staff guard; their anonymous EXECUTE grants are revoked. The older `get_my_role()` helper is separately flagged for anonymous EXECUTE. Leaked-password protection is disabled. These existing settings were not changed in this session.

References: [function execution advisory](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [password protection setting](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Personnel dashboard data (applied 14 October 2026)

Nine migrations were written against the verified live definitions, validated
in rollback transactions, and applied through the linked CLI (each in its own
transaction; migration history synced):

| Migration | Purpose |
|---|---|
| `20261015090000_activity_events` | Append-only `activity_events` + `security_events`, actor derivation, whitelisted change capture, triggers on 12 tables |
| `20261015091000_inventory_soft_void` | Inventory undo/re-scan keeps history (void instead of delete/overwrite) |
| `20261015092000_activity_prologues` | One-line action context added to 19 RPCs + 2 helpers (idempotent patcher) |
| `20261015093000_loan_return_recorded_at` | "When the return was entered" marker on `book_loans` |
| `20261015094000_provenance` | Evidence-based provenance labels + `provenance_batches` (demo/seed/setup/unknown/live) |
| `20261015095000_activity_read_rpcs` | `lirc_activity_feed` / `_trace` / `_for_entity` with server-built descriptions |
| `20261016090000_goals_schema` | Goals, frozen items, members, scope revisions, append-only contribution ledger (+ guards, RLS) |
| `20261016091000_goals_rpcs` | Goal RPCs (create/activate/revise/review/aggregates/reconcile) |
| `20261017090000_inventory_pilot_wiring` | Inventory credit rules, physical-check + reconciliation aggregates, `lirc_goal_verify_item`, barcode download history |
| `20261018090000_personnel_dashboard_rpcs` | `lirc_sign_in_activity`, `lirc_goal_review_queue`, `lirc_goal_my_contribution` gains work/review kinds |
| `20261018091000_goal_event_descriptions` | Goal events read as real sentences in the activity feed |
| `20261018100000_activity_log_page` | Admin User logs page (`lirc_activity_log_page`, numbered pages) + personal activity summary |
| `20261018110000_remove_goals` | The goal system was removed entirely (tables, RPCs, helpers); inventory functions restored to their pre-credit versions; historical goal events stay readable in the log |
| `20261018120000_activity_filter_groups` | Activity filters match several action families per chip (`action_prefixes`); dashboard shows own actions only |
| `20261018130000_my_activity_stats` | Personal chart data: 30-day daily counts, per-kind groups, active days, streak and busiest day (server-computed) |
| `20261018140000_activity_log_search` | User logs: person search (word-order-free + close spellings) and Manila-time date/time range filters |
| `20261018150000_library_validation_terms` | Terminology: the annual enrollment process reads as "Library validation" in the feed and User logs |
| `20261018160000_validation_status_labels` | Status words everywhere: `enrolled` reads as "Validated" (borrow checks and validation-change notifications included) |
| `20261018170000_personnel_performance` | Admin User performance page: people list (librarian/staff/admin) and one person's summarized statistics from a shared aggregation helper |
| `20261018180000_enrollment_request_links` | Validation change requests: notifications deep-link to the exact request (`/enrollments?request=<id>`), plus `lirc_enrollment_requests` (tabs) and `lirc_enrollment_request_detail` |
| `20261018190000_inventory_start_admin` | Starting an inventory session is admin-only (`lirc_inventory_start`); counting, pausing, resuming and finishing stay open to staff and librarians |
| `20261018200000_roles_and_paging` | Staff can work the Attendance desk (`attendance_staff_id` widened; validation family moved to `validation_staff_id`); adding members is admin-only; sign-in history gains `p_offset` + `has_more` |
| `20261018210000_policy_function_grants` | Hotfix: restore EXECUTE on `attendance_staff_id` / `validation_staff_id` — RLS policies run as the querying role, so revoked helpers broke the profile read (403) and the enrollment policies |
| `20261018220000_profile_and_notification_pages` | Notifications page support (`lirc_notification_feed` gains `p_limit`/`p_offset`, `total`, `has_more`) and the profile page (`lirc_my_profile` — own basic info with department/program/position names + email) |
| `20261018230000_profile_avatars` | Profile photos: `usersData.avatar_url`, a public `avatars` storage bucket (own-folder policy), `lirc_set_my_avatar` (validated), preset images + the fallback |
| `20261018240000_avatars_in_reports` | Photos flow into staff screens: visit rows, member lookup, member record and the performance profile carry `avatar_url` |
| `20261018250000_program_departments` | Programs belong to departments (`programs.department_id`): DBA — BSA/BSAIS; DTE — BEED/BECED/BSED/BSE-*; DCI — BSCS/BSIT; DAS — BSPSY. 7,371 members classified in `usersData.department_id` (BSP and BS-F left for the registrar) |
| `20261018260000_bsf_department` | Registrar follow-up: BS-F → DTE (its member classified); BSP stays unassigned until classified |
| `20261018270000_attendance_export_rpc` | One-call attendance export (`lirc_attendance_export`) — the Excel report reads every filtered visit in one request instead of ~100 pages |
| `20261018280000_library_id_lower_index` | Cleanup: functional index on `lower(library_id)` for case-insensitive card lookups and duplicate checks |

The goal system is **removed** (14 October 2026). The personnel dashboard and
the admin **User logs** page read the activity log directly.


Details and metric definitions: [PERSONNEL_DASHBOARD.md](PERSONNEL_DASHBOARD.md).

