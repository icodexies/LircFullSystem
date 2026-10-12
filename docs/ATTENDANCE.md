# Academic periods, annual validation and attendance

The existing React auth provider, signed-in layout and route guards are reused. New screens are **Attendance**, **Annual enrollment** and **Academic periods**. Only `admin` and `librarian` can operate them.

## Required database steps

The database setup was checked live on 9 October 2026. The base schema, annual conversion, initial seed and report functions are already applied. Do not rerun them. See [current database status](DATABASE_SETUP_STATUS.md) and [the plain-language filter guide](FILTER_GUIDE.md).

The base `lirc_attendance_semesters.sql` was already applied according to your prompt. **Do not rerun it.** The two supplied follow-up scripts were found in Downloads and copied into `supabase/manual/`, outside automatically applied migrations:

1. `lirc_migrate_annual_validation.sql`: run once **only if annual migration has not already been applied**. An owner can check `information_schema.columns` for `public.student_enrollments.academic_year_id`. The presence of that column means this conversion is already applied; do not rerun it. Its own guard also prevents a second conversion.
2. `lirc_seed_periods_initial_validation.sql`: copied from the corrected Downloads file ending `(1).sql`. Run once only if this authorized initialization has not already happened, after annual conversion. Its July 1–January 15 and January 16–May 31 dates are **provisional**. Confirm the calendar before attendance exists. If more than one eligible Auth-linked admin/librarian exists, explicitly set `v_validator_profile_id`. Unsupported card formats need the supplied override table. Confirmed inactive statuses stop initialization for review. Existing verified levels are preserved. This is an enrollment **assumption for initial 2026-2027 setup**, not registrar verification; never repeat it for a new year.
3. New required migration: `supabase/migrations/20261009000100_annual_attendance_reports.sql`. Run after the annual schema exists. It adds the staff-only reporting/options RPCs and indexes. It adjusts the earlier OPAC restrictive profile-read boundary so an admin/librarian can use the supplied staff profile-read policy. Other members still read only their own profile; no profile-write or role-edit permission is added.

If conversion stops on duplicate student/year validations, it rolls back. Use the diagnostic SELECT at the end of the supplied migration to list affected profile IDs, academic years and enrollment IDs. Review status, validation source and linked attendance before designing a merge; do not delete or arbitrarily choose records. The UI does not run conversion or initialization.

The report migration discovers department/program/position classification tables through the actual foreign keys on `usersData`, matching reference-column or lookup-table names. It reads a `name`, matching classification-name, `title` or `code` label column. Without a matching FK it issues a NOTICE and displays that dimension as unassigned; review those notices against the real schema before release. A table with no recognized label column stops the migration for explicit configuration. These are **current-profile** classifications; historical visits have no department/program/position snapshots.

Keep `lirc_private` outside exposed API schemas. Only the existing public/publishable Supabase key belongs in Vite. Server triggers and RLS remain authoritative.

## Staff workflow

1. Open **Academic periods**. Create academic years with start year and confirmed school dates; the database generates the year name. Create semesters inside that year, with name and dates. Edit provisional dates before attendance exists.
2. Choose **Make active**, then confirm its global effect. This calls the supplied atomic RPC. Personal header selection is untouched. An active period outside its dates blocks new time-ins. Creating/selecting a period never initializes annual enrollment.
3. Use the header to choose a **viewing** semester. Choices are grouped by academic year and mark the globally active semester. It defaults to active, validates saved IDs and stores a separate preference for each Auth user. Logout/account changes unmount isolated semester, scanner and request state; a user's preference can be restored on their next login. Focus refreshes the period store.
4. Open **Annual enrollment**. The selected semester derives the target academic year. Both semesters show the same annual records/counts. All current student profiles appear, including absent records. Select a student and choose their **status** (enrolled, on leave, withdrawn, graduated or unverified). The system sets the year level from the library card and any recorded leave years — no reference or explanation is typed. Saving validation is not a visit. The window also lists the **validation history** for every school year: status, year level, who validated it and when. Past school years cannot be saved directly: a librarian submits a change request and an admin approves or rejects it in the same window (admins apply past-year changes immediately). Approving recomputes later years' levels. Every action also lands in the header notification bell.
5. Open **Attendance → Open scanner**. Scan or enter the card into the dedicated input. Enter only performs a lookup. Optional Tab terminator works only in this input; no global hotkey captures normal typing/navigation. Paired Code 39 wrappers are removed; leading zeros and internal characters are preserved.
6. The system decides the action automatically and records it in one step — there is no separate look-up or preview screen. A visitor with an open visit gets a **time out** (closing that exact visit, even one from an older semester or year); anyone else gets a **time in**.
7. Choose the **purpose of the visit** before scanning (Other requires text); it is used when the scan records a time in. A time out does not use the purpose — the one saved at time in is kept. A student needs current-year validated enrolled status with a year level; a blocked visitor shows a message instead of being recorded. Nonstudents skip annual validation and need no Auth account.

Successful transactions keep the scanner open, clear card and purpose, refresh reports and refocus the mounted input. Repeated in-flight actions are locked; a later revisit remains possible. Time-in quietly re-reads the card right before writing; a changed enrollment, active period or open visit stops the write and asks for another scan. The database handles races after that read with triggers and the unique open-visit index.

Historical viewing shows a banner and blocks new time-in, with a **View active semester** action. It never silently switches filters. Attendance table rows with no time-out still offer **Time out** to close them.

## Annual validation and history

One student + academic year has one enrollment record. Its confirmed status can change during the year, and changed inactive status blocks subsequent time-ins. Switching semesters does not increment level or require revalidation. A new academic year starts with missing/unverified records; prior years stay intact.

System-derived year level: supported `YY-...` cards mean `2000 + YY`; the level is academic-year start minus admission year plus one, minus one for each recorded **leave-of-absence** year, when the result is 1–4. A `22-...` card in 2026 computes past four years: saving "enrolled" is refused and staff record graduated, withdrawn or on leave instead. Legacy stored values outside 1–4 display **Needs review** until the record is saved again, which derives the level from the system. Stored records and historical visits remain intact, including checkout of old visits. See migrations `20261009115403_enrolled_year_levels_one_to_four.sql` and `20261012150000_system_computed_year_levels.sql`, already applied to Supabase.

Attendance insert sends only profile ID, active semester ID and purpose. The server supplies time, operator and immutable role/year/note snapshots. Checkout updates only `time_out` on the exact open ID; server time replaces the client placeholder. Completed records are immutable. Annual student, academic-year and legacy-provenance keys never appear in update payloads. New validations leave legacy provenance NULL.

Academic-year start year/name and a semester's parent academic year are immutable. Semester dates cannot change after attendance exists. Academic-year date bounds must contain its semesters; semester dates cannot overlap within a year.

## Reports, filters and performance

Attendance reporting filters the exact selected semester. Annual reporting filters its academic year with a left join from students. Reports return 20 rows, server-side totals and a next-page flag. One filtered server dataset powers rows, summary cards and pagination. CSV export calls the same RPC/filters in 100-row batches; it is explicit and cancellable. Summary cards count visits and unique visitors separately, count selected-period open visits and average only completed duration.

Primary filters are compact; Advanced filters expand detailed options, with removable chips and Reset. Attendance supports name/card/name-part search, visitor type, year level at visit, classifications/unassigned, purpose/custom text, visit date range and arrival time-of-day (Philippine time), still-inside/checked-out status, time-in/time-out operators and student status now. Annual validation supports current students' name/card, card year prefix, classifications, status, the system's estimated level, validation state, validation dates/validated-by and login-account presence. Sorts are whitelisted with explicit NULL ordering and an ID tie-breaker.

Typed filters combine across records/cards/counts/export. Text is debounced, changed scope resets page one, old requests are aborted and late results ignored. Selected period and filter values form request keys. Missing IDs issue no broad query. CSV timestamps retain explicit timezone/ISO values; table/clock display Asia/Manila. Manila dates become UTC midnight boundaries with an exclusive next-day end. Exports read a live report across batches; concurrent edits can move rows, so use a quiet/reporting snapshot workflow if a legally fixed export is required.

`usePeriodReport` and `applySemesterFilter` provide reusable opt-in period patterns. They are applied to attendance and annual enrollment only. Catalog/books/inventory lookup tables have no semester column; their existing queries/content are unchanged. No new frontend dependencies or alternate auth system were added. Large simultaneous workloads still need staging load tests; registered-user count alone does not establish capacity.

## Code map

| Location                                                           | Responsibility                                                       |
| ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `src/context/periods/`                                             | User-isolated shared semester store                                  |
| `src/hooks/periods/`                                               | Store access and cancellable scoped report queries                   |
| `src/services/periods/`                                            | Semester/year reads, explicit management writes, period rules        |
| `src/services/attendance/`                                         | Scanner/enrollment/report calls, input/date/eligibility rules        |
| `src/components/periods/SemesterSelector.jsx`                      | Header viewing selector                                              |
| `src/components/attendance/`                                       | Scanner, validation form, filters, export, tables and isolated clock |
| `src/pages/PrivatePages/Attendance/`                               | Selected-period attendance and separate open-visit operational view  |
| `src/pages/PrivatePages/Enrollments/`                              | Annual all-student validation view                                   |
| `src/pages/PrivatePages/AcademicPeriods/`                          | School calendar and explicit global activation                       |
| `src/routes/roles.js`, `memberPages.js`, `src/App.jsx`             | Roles, navigation and existing guarded routes                        |
| `supabase/manual/`                                                 | Supplied one-time annual conversion and corrected seed               |
| `supabase/migrations/20261009000100_annual_attendance_reports.sql` | Additional staff-only reports/options and indexes                    |
| `tests/attendance/`                                                | Targeted eligibility/date/preference/filter tests                    |

The former app role `staff` was allowed on Attendance, but the supplied database operator contract excludes it. Attendance/enrollment/period pages now allow only librarian/admin. `staff` retains its other existing tools; it is not silently mapped to an operator. `non_teaching_personnel` is a visitor/member role with the same Overview and Catalog pages as faculty, not an attendance operator. The supplied attendance visit-role constraint excludes `staff`; such imported profiles need an explicit reviewed classification if they should attend as visitors. No database roles/profile records were rewritten.

## Verification

Project tests, lint and production build were run. Additional isolated PostgreSQL tests execute the supplied schema/conversion and new reporting migration against synthetic profiles only; they cover RLS, annual left joins, both-semester links, new-year unverified state, verified conflict history, duplicate visits, server checkout, cross-semester closure, filtered summaries/export pagination, date boundaries and conversion rollback conflicts. Mock request/state tests verify minimal payloads, exact conditional checkout, immutable annual keys, shared export filters, page resets and stale-response cancellation.

Browser tests use a separate local demo client, never the production Supabase client. They verify one-step scan-and-record, automatic time-in/time-out decision, purpose use on time in, scanner clear/refocus, missing validation, old-semester checkout, distinct viewing/global activation, account-scoped preferences, both-semester annual results, management confirmation and responsive layout. No hosted database tests or real scanner-device tests are claimed. After manually applying the prerequisite scripts and report migration, verify the real classification FK mapping and workflows with dedicated authorized staging accounts before rollout.
