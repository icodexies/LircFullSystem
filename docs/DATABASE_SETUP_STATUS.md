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
| `20261018290000_performance_reports` | Monthly AI summaries: `performance_reports` (one row per person per month), `lirc_performance_ai_input` (service-role month dossier), `lirc_performance_reports` (admin list); `is_admin()` execute grant so read policies work |
| `20261018300000_attendance_recorded_by_nullable` | `attendance.recorded_by` is nullable — legacy imports have no operator on record; the app's own visits always carry one (the guard trigger sets it) |
| `20261018310000_performance_ai_burst_signal` | AI dossier gains the busiest five-minute window (`max_actions_in_5_min`); the rating weighs same-action bursts heavily (days worked are context only) |
| `20261018320000_performance_ai_history` | AI dossier gains the person's previous monthly ratings; the stored `trend` (First month / Improved / Steady / Declined) follows on the report list |
| `20261018330000_guest_visitors` | Guest visitors: the `guest` visitor type, `attendance.guest_name`/`guest_detail` (saved per visit), ten reusable GUEST-01…GUEST-10 profiles, and purpose data on the library's own list (Study, Research, Borrow Books, Return Books, LOA, EXIT CLEARANCE, INTERVIEW, THESIS, OJT, Others) |
| `20261018340000_loan_records` | Book Borrow record tabs: `lirc_loan_records` (borrowed / overdue / returned lists with person/role/book/date filters, server-side totals and tab counts) + two tab-sort indexes on `book_loans` |
| `20261018350000_statistics_overview` | Statistics page numbers: `lirc_statistics_overview` (catalog sizes and availability, borrowing states, member counts by role, current-year validation progress, active-semester visits) — read-only aggregates for any signed-in member |
| `20261018360000_statistics_details` | Statistics detail views (staff / librarian / admin): `lirc_statistics_borrowing` (12-month borrowed/returned/overdue series, totals, most borrowed books by department / year level / program, most active borrowers, top books) and `lirc_statistics_attendance` (12-month visits/unique series, busiest hours, purpose / visitor-type / department breakdowns, most frequent visitors); overview gains members by department + validation status breakdown |
| `20261018370000_statistics_book_tree` | The borrowing rankings become one drill-down tree (`books_tree`: department → program → year level, each with its loan count and top five books); the flat rankings are replaced, and the view lists each section as clickable rows opening a modal that walks the tree one level at a time |
| `20261018380000_statistics_semester_filter` | Statistics follow the header semester: every statistics function gains `p_semester_id` (null → active semester). Borrowing covers loans that started in it, attendance its visits, members its active members (visited or borrowed), validation its school year (annual — both semesters share), catalog stays timeless; monthly lines use the semester's own months |
| `20261018390000_statistics_record_links` | Statistics record shortcuts: top books, the drill tree's book lists and the top borrowers/visitors now carry their record ids — "View details" opens the book's OPAC window (`/opac?book=<id>`) and "View record" opens the member's Users record (`/users?member=<id>`) |
| `20261018400000_statistics_attendance_tree` | Attendance statistics organized like the report: `lirc_statistics_attendance` gains `visits_tree` (department → program → year level, each with visits, unique visitors, average stay and its five most frequent visitors) for clickable rows + a drill modal; new `lirc_statistics_borrower` (one member's semester record — frequency, books borrowed, recent loans) powers the "Most active borrowers" modal |
| `20261018410000_statistics_borrowers` | The Borrowers category: `lirc_statistics_borrowers` (how many borrowed, repeat/first-time, average per borrower, top twenty borrowers, who is overdue right now, borrowers by role and department) + the overview gains the matching `borrowers` summary for the sixth card; stale no-argument statistics overloads dropped |
| `20261018420000_validation_overdue_permission` | Overdue books block library validation: the enrollment guard rejects a validating save while the student has books past due, and the request workflow accepts a **current-year** request for those students (the admin notification says why); approving it saves the validation. Appears in the page's existing request tabs |
| `20261018430000_overdue_reminders` | Daily overdue reminders: `notifications.dedupe_key` (one reminder per loan per day), `lirc_private.send_overdue_reminders()` (a reminder on the due date, then daily while overdue, up to 30 days past due), and the pg_cron job `lirc-overdue-reminders` running at 08:00 Philippine time. The bell needs the member to have a login account |
| `20261018440000_path_finder` | Path Finder: curriculum reference tables (`curriculum_programs`, `curriculum_subjects`, `curriculum_entries`) and `subject_recommendations` (books attached to the **course code**, so shared subjects share one list; librarian adds are approved at once, faculty suggestions start as pending). RPCs: `lirc_path_finder_programs` / `_curriculum` / `_suggestions` (reads, member-visible) and `_add_recommendation` / `_suggest` / `_review` / `_remove` / `_withdraw` (role-guarded); librarians get a bell alert on every suggestion, faculty on every decision |
| `20261018450000_path_finder_curriculum` | The registrar's prospectus loaded once: **12 programs** (each linked to its library program, e.g. BSEd-MATH - BSE-M), **364 subjects**, **647 placements** (program × year × semester); identity sequences set past the explicit ids and the counts checked (12/364/647) |
| `20261018460000_path_finder_personal` | The programs list flags the caller's own program (`mine`) - their exact program, or their department's first for faculty - so the page opens the member's curriculum first |
| `20261018470000_fines_and_settings` | Fines and charges + the settings store: `app_settings` (first setting `fines` = enabled + rate, **off by default**), `library_fines` (overdue charges assessed automatically when a late loan is returned - days late × rate, a started day counts; lost-copy charges when a librarian marks a copy lost), unpaid fines block new borrows, staff settle as paid/waived. RPCs: `lirc_settings_get` / `lirc_settings_set_fines` (**admin only**), `lirc_member_fines`, `lirc_my_fines`, `lirc_flag_copy_lost`, `lirc_fine_settle`. Lost copies stop counting as available in Path Finder |
| `20261018480000_inventory_lost_archive` | Inventory gains the **Lost** condition (scan + edit dialogs, counts and history chips). The copy's **status now follows its latest live scan**: Good - Available (the only copies circulation shows), Damaged/Missing/Lost - archived (hidden from the copies windows and the OPAC copy lists, never borrowable; the borrow RPC already rejects non-available copies). Marking a copy lost from the fines flow sets the condition too, so both paths agree; scanning a lost copy as Good again returns it to circulation. `found_lost` joins the inventory counts |
| `20261018490000_borrow_report` | The **Book Borrow report** (Report tab): `lirc_borrow_report` (one page of loans + totals + summary) and `lirc_borrow_report_export` (every matching loan for the Excel job), both built on `lirc_private.borrow_report_rows` with filters for borrowed / due / returned date ranges, status (open / overdue / returned / late), role, search (member or book), sort and direction. The Excel report (background job, like attendance) has a Report sheet (applied filters, summary, loans by role, loans by month, most borrowed books) and a Loans sheet with every row |
| `20261018500000_subject_ai_findings` | **AI book recommendations per subject** (librarian/admin only): `subject_ai_findings` caches one AI research run per course code (picks from the catalog published within the last 5 years - the CHED rule - plus acquisition suggestions with sources), so re-opening a subject is a plain read and tokens are only spent on "Search again". The `subject-recommendations` edge function (Gemini; web-grounded when the key allows) writes the rows. **Acquisition list**: `acquisition_suggestions` (ai / faculty / librarian sources) with `lirc_acquisition_suggest` (faculty + staff), `lirc_acquisition_add_from_ai`, `lirc_acquisition_list` / `_review` / `_withdraw` (operators review; suggesters are notified), shown in the Path Finder **Acquisitions** tab |
| `20261018510000_path_finder_visibility` | Path Finder visibility hardening: students and faculty only ever see recommendations a librarian **approved** (faculty suggestions stay invisible until then; faculty see only their own pending note). The programs list no longer sends the pending-suggestion count to non-operators (it was displayed operator-only but shipped to everyone) |
| `20261018520000_announcements` | **Announcement board** (admins only): `announcements` (title, body, optional image, audience everyone/students/faculty, pinned, draft/published, "Show until" window) with `lirc_announcements_feed` (the member popup: active announcements for the caller's audience, pinned first, capped at 12) and `lirc_announcements_manage` / `lirc_announcement_save` / `lirc_announcement_set_status` / `lirc_announcement_delete` (admin-guarded). The public `announcement-images` bucket takes admin WebP uploads only (insert-only, never overwrite/delete) |
| `20261018530000_announcement_show_until_date` | "Show until" keeps the whole chosen day and shows the chosen date: the save function stores the day's last visible moment (23:59:59.999 Philippine time) instead of the next midnight, and existing rows saved by the first version were corrected |
| `20261018540000_my_statistics` | **Member statistics**: `lirc_my_statistics` (any signed-in member) returns the caller's own borrowing and attendance records for the semester, plus reader-useful library-wide numbers — the most borrowed titles (counts only) and the monthly visits/loans trend. No other member's data is included. The Statistics page routes by role: librarians/admins keep the full operational page; students/faculty/staff see this member view |
| `20261018550000_my_statistics_department` | Member statistics adjustment: "Most borrowed" is the caller's **own department's** list (the same grouping the borrowing statistics use — other departments' records are never included; members without a department fall back to the whole library), and the library-wide trend block was removed with its card |
| `20261018560000_my_loans` | **My Borrowing page** for borrowers (students, faculty, staff, non-teaching personnel): `lirc_my_loans` returns the caller's own circulation records — still out, overdue and returned — with a status filter, search (title, author or accession number) and paging; totals are all-time and only the caller's own rows are ever returned. The circulation desk keeps Book Borrow for everyone else's records |
| `20261018570000_my_statistics_programs` | Member statistics adjustment: the "My borrowing" card was removed (personal borrowing lives on the My Borrowing page) and "Most borrowed" now also breaks down **by program** — each program in the caller's department with its loan count and top 5 titles, matching the borrowing statistics' program level |
| `20261018580000_my_statistics_programs_cleanup` | The "By program" breakdown lists real programs only — borrowers with no program on record are left out of the program sections (their loans still count in the department's overall most-borrowed list) |
| `20261018590000_home_collection` | **Home page collection**: `lirc_home_collection` (granted to anonymous visitors too — the home page is public) returns physical ("Books" format) catalog titles with their section, ISBN, publisher/year, call number and live availability counts; covers first. The home carousel now shows real catalog books instead of hardcoded samples, resolves covers like the OPAC (library upload → Open Library API by ISBN → gradient placeholder), and the physical panel browses by section |
| `20261018600000_home_collection_spread` | Home collection candidates now spread deterministically across the whole catalog (stable hash order, uploaded covers first) so the carousel surfaces titles the Open Library covers API actually covers — the newest local imprints rarely have API covers |

The official **library card holder workbooks** corrected the student programs
in two passes. First: `LIBRARY CARD HOLDERS UPDATED 2025.xlsx` — 860 records
realigned to its rosters (mostly **BSP → BSPSY**, plus BSA/BSAIS crossings).
Then: `UPDATED LIBRARY CARD HOLDERS.xlsx` (adds the 25- cohort) — 180 records
follow the updated workbook (**BSA/BSAIS** and small corrections); **BSP and
BSPSY are the same program, always stored as BSPSY**, so the psychology
students stayed put. The applied scripts are
`supabase/manual/library_card_programs_update.sql` and the 2026 run below;
all runs are in `provenance_batches`.

The **2026 intake** arrived as `2026 lib holder.csv`: **1,572 students** with
`26-` cards received their program and department, and the new **BAC**
(Bachelor of Arts in Communication) program was added under **Arts and
Sciences (DAS)**. One row carried `BSA-SS` — not a program code — so a single
student (26-15261) stays unassigned. Script:
`supabase/manual/library_card_programs_2026.sql`.

**Duplicate student records merged** (legacy import leftovers): 31 pairs
where the same name and middle initial appeared on two cards — the newer
card is kept, its visits and enrollments moved to it, and the duplicate
removed. Five same-name pairs with **different middle initials** stay as
different people. Script: `supabase/manual/duplicate_student_merge.sql`.
The `MAYZIE` workbook copy checked against the database shows no remaining
conflicts.

Attendance now holds the **real records imported from the previous system**
(4,498 visits, March–October 2026; the demo/seed rows and their log lines were
removed). Incomplete legacy rows (no time in or no time out) were left out;
the import is recorded in `provenance_batches` (label `import`) and is
reproducible from `supabase/manual/legacy_attendance_import.sql`. The legacy
purpose labels were re-derived from the same dump, so real Borrow Books /
Return Books / THESIS / OJT / EXIT CLEARANCE rows keep their true purpose
(re-run: the small fix block reads the dump; 28 rows changed).

The goal system is **removed** (14 October 2026). The personnel dashboard and
the admin **User logs** page read the activity log directly.

**Path Finder** (16 October 2026): the registrar's prospectus
(`curriculum.sql`) lives in the three `curriculum_*` tables; book
recommendations attach to the **course code**, so shared subjects (for
example MATH101 in every program) share one list. Librarians add books
directly (approved at once); faculty suggest books and librarians approve or
reject them - both sides get a bell alert. Students see their program's
approved lists and open any book in the OPAC. Every table is RPC-only (no
client policies), matching the member-change-request pattern.

**Fines and charges** (16 October 2026): switched by the `fines` setting in
**Settings** (gear beside the dark-mode button; only admins change it).
When ON: a late return is charged ₱5/day (a started day counts) the moment
the return is recorded, a copy marked lost (Copies & loans window) closes
its loan and charges the borrower the replacement amount, and members with
unpaid fines cannot borrow until staff settle them (paid/waived) from the
member's record. When OFF nothing is assessed, shown, or enforced - existing
ledger rows are kept for when it is switched back on. The sample admin
account `admin@ccc.edu.ph / Admin#2026` (ADM-0001 Alex R. Mendoza) was
added for testing the settings.


Details and metric definitions: [PERSONNEL_DASHBOARD.md](PERSONNEL_DASHBOARD.md).

