# Live database setup status

Verified and completed on 9 October 2026 through the connected Supabase integration.

## Latest year-level correction

Migration `20261009115403_enrolled_year_levels_one_to_four.sql` was applied on 9 October 2026. New enrolled validations and student time-ins require a confirmed level 1–4. Card estimates outside 1–4 are unavailable. Old records are preserved for review, rather than automatically marked withdrawn or made fourth year.

Live read-only verification: **9,643** annual records; **7,687** in the validated count and **1,956** enrolled legacy records needing year-level review. Choose **Annual validation → Advanced filters → Validation state → Needs year-level review** to find them. Confirm their actual level or status using school records. Historical checkout is still permitted. No student status, stored level, active semester or attendance row was rewritten by this correction.

The earlier setup audit below describes the state before this correction. All setup scripts are already applied; do not rerun the initial seed. See [filter explanations](FILTER_GUIDE.md) and [shared dialog usage](DIALOGS.md).

At the latest read-only check, the active semester is **2026-2027 · 2nd Semester**, dated **16 January–31 May 2027**. Its activation was last updated at 7:39 PM Philippine time on 9 October 2026, before this year-level migration. This work did not change it. Because its dates are in the future, new time-ins remain blocked even for valid students. If the school is currently in the first semester, use Academic periods → Make active on the correct semester after confirming the official calendar. Viewing the first semester in the header alone does not activate it.

Project: **lmsDatabase** (`jrrwhrnqembviaocrdmi`). The local app's `VITE_SUPABASE_URL` matches this project.

## What is already done

| Setup | Status |
| --- | --- |
| Base academic-period and attendance schema | Already applied; do not rerun |
| Annual enrollment conversion | Already applied; `academic_year_id` and read-only legacy provenance exist |
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

- Live annual report: 9,643 students, 9,643 initialized annual validations, first page limited to 20 records, Next available.
- Live attendance report: zero visits, zero inside, zero unique visitors, no completed-duration average.
- Classification options: four departments, fifteen programs, three position classifications. Actual profile FK columns map to `departments`, `programs` and `position_classifications` with their `name` labels.
- Anonymous callers have no EXECUTE grant on the five staff scanner/period/report RPCs. An authenticated caller without a staff profile is rejected by report/options guards and cannot read profiles/enrollments/attendance through RLS.
- Unique annual-validation/open-visit indexes and attendance/enrollment triggers are present.
- Final counts match the pre-change audit: 9,991 profiles, 3,034 books, 6,259 physical copies, 9,643 annual validations and zero attendance rows. Active semester remains unchanged.

These are database-level read checks and metadata verification, not a real scanner/device or production load test. No live attendance writes, student-status changes, account creation or bulk initialization were used as tests.

## What to do in the app

Your existing database setup does not need another SQL run for these features. Sign in with your admin account, then open Attendance, Annual enrollment or Academic periods. Use the header for personal viewing; use the explicit Make active control only when the school changes the global transaction period. Confirm official calendar dates and correct exceptional student year levels using verified school records.

The detailed staff workflow remains in [ATTENDANCE.md](ATTENDANCE.md); cover/edit behavior is in [OPAC.md](OPAC.md). Their earlier local-only verification descriptions refer to implementation before this live setup session; this status note records the current live state.

## Existing advisor notices outside this setup change

Supabase's advisor still flags the authenticated SECURITY DEFINER entry points, which intentionally enforce the trusted staff guard; their anonymous EXECUTE grants are revoked. The older `get_my_role()` helper is separately flagged for anonymous EXECUTE. Leaked-password protection is disabled. These existing settings were not changed in this session.

References: [function execution advisory](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [password protection setting](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
