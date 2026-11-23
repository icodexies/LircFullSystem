# LIRC System - Project Map

This is the canonical navigation map for the LIRC library system. It is an index, not a replacement for reading the files that are about to change. When this map disagrees with the source code or live database, the source/live contract wins and the map must be corrected in the same change.

| Field | Value |
| --- | --- |
| Last full verification | 2026-11-23 |
| Base code | `4945ae0`; documentation changes from the 2026-11-19 scan are listed in `docs/CHANGE_LOG.md` |
| Frontend | React 19, Vite 8, React Router 7, Tailwind CSS 4 |
| Backend | Supabase Auth, Postgres/PostgREST RPCs, Storage, Edge Functions |
| Live frontend | https://ccc-lirc.vercel.app |
| Repository | `icodexies/LircFullSystem` |
| Linked Supabase project | `jrrwhrnqembviaocrdmi` |
| Node requirement | `22.23.4+`, `24.22.1+` or `26.12.1+` |
| Baseline scan | 27 page files, 130 migrations, 5 Edge Functions, 26 test files, 139 passing tests |

Use this map with `AGENTS.md`, `docs/AGENT_WORKFLOW.md` and `docs/CHANGE_LOG.md`.

## 1. Boot and request flow

```text
index.html
  -> src/main.jsx (React StrictMode)
  -> src/App.jsx
       ThemeProvider
       LoginProvider
       AuthProvider
       BrowserRouter
       ToastProvider
       DialogProvider
       Routes
         PublicLayout -> Home
         Public pages -> Register / Forgot / Reset password
         PrivateRoute -> System stations or MemberLayout
         MemberLayout
           SemesterProvider
           NotificationProvider
           ScannerProvider
           DisplaySizeProvider
           Page -> feature component -> hook -> service -> Supabase
```

### Routing and access

- `src/App.jsx` defines the actual route tree and lazy imports.
- `src/routes/guards.jsx` contains `PublicOnlyRoute` and `PrivateRoute`.
- `src/routes/roles.js` defines role names and `ACCESS` groups.
- `src/routes/memberPages.js` is the shared source for sidebar order, labels, paths and page roles.
- `src/routes/memberScreens.js` contains the lazy page imports and prefetch map.
- A sidebar page must be added to both `memberPages.js` and `memberScreens.js`.
- Adding a page only to the sidebar or only to `App.jsx` produces inconsistent access.
- Frontend route guards are not security. The RPC/table/RLS layer must enforce the same rule.

### Role groups

| Group | Roles |
| --- | --- |
| `ACCESS.member` | student, faculty, non_teaching_personnel, staff, librarian, admin |
| `ACCESS.borrowers` | student, faculty, non_teaching_personnel, staff |
| `ACCESS.staff` | staff, librarian, admin |
| `ACCESS.books` | staff, librarian, admin |
| `ACCESS.attendance` | staff, librarian, admin |
| `ACCESS.validation` | librarian, admin |
| `ACCESS.admin` | admin |
| `ACCESS.systemStations` | system_borrow, system_attendance |

### Routes

| URL | Page | Access |
| --- | --- | --- |
| `/` | Public home | Signed-out/public-only |
| `/register` | Registration/email claim | Public-only |
| `/forgot-password` | Password reset request | Public-only |
| `/reset-password` | Password reset completion | Public, signed in or out |
| `/unauthorized` | Access denied | Any |
| `/system` | System station chooser | `systemStations` |
| `/dashboard` | Dashboard | `member` |
| `/statistics` | Statistics | `member` |
| `/my-borrowing` | My borrowing and holds | `borrowers` |
| `/announcements` | Announcements | `member` |
| `/opac` | OPAC catalog | `member` |
| `/path-finder` | Curriculum recommendations | `member` |
| `/users` | Member records | `staff` |
| `/user-logs` | Activity log | `admin` |
| `/user-performance` | Personnel performance | `admin` |
| `/attendance` | Attendance desk/report | `attendance` |
| `/enrollments` | Annual and online validation | `validation` |
| `/academic-periods` | Academic years/semesters | `validation` |
| `/adding-books` | Add titles/copies | `books` |
| `/inventory` | Inventory sessions | `staff` |
| `/book-borrow` | Circulation desk | `staff` |
| `/barcode-generator` | Barcode queue/templates | `staff` |
| `/profile` | Profile and library card | `member` |
| `/notifications` | Notification feed | `member` |
| `/settings` | Fines/settings | `books` route; admin-only changes inside page |
| `/home` | Redirect to `/dashboard` | `member` |

Known documentation drift: `docs/ATTENDANCE.md` contains an older statement that attendance is librarian/admin only, while the current code routes `/attendance` through `ACCESS.attendance`, which includes staff. Check `src/routes/roles.js` and the RPC guard before changing access.

## 2. Request router

Find the request by its keywords, then open the **Read first** files. Add the supporting files only as the task requires. Do not open every service in the same folder.

### Platform, catalog and public site

| Request keywords | Read first | Supporting files / contract | Tests / docs |
| --- | --- | --- | --- |
| Login, logout, session, remember me, login modal | `src/components/auth/LoginModal.jsx`, `src/context/auth/AuthContext.jsx` | `src/hooks/auth/useLogin.js`, `src/services/auth/authService.js`, `authStorage.js`, `src/context/login/` | `tests/auth/`, `docs/API_SECURITY.md` |
| Registration, email link, claim account, register | `src/pages/PublicPages/RegisterPage/Register.jsx` | `src/services/auth/authService.js`, `src/hooks/auth/useLogin.js`, `supabase/functions/registration/index.ts`, `registration_tokens` | `docs/REGISTRATION.md` |
| Forgot/reset password | `src/pages/PublicPages/ForgotPasswordPage/ForgotPassword.jsx`, `ResetPasswordPage/ResetPassword.jsx` | `authService.js`, `supabase/functions/request-password-reset/index.ts`, `password_reset_requests` | `docs/PASSWORD_RESET.md` |
| Sidebar, header, navigation, page permissions, unauthorized | `src/routes/memberPages.js`, `src/routes/roles.js` | `src/App.jsx`, `guards.jsx`, `memberScreens.js`, `src/layouts/member/MemberLayout.jsx`, `src/components/layout/member/` | `tests/routes/memberAccess.test.js`, `docs/MEMBER_LAYOUT.md` |
| Landing page, hero, carousel, public books, digital sources, about | `src/pages/PublicPages/HomePage/Home.jsx` | `src/components/home/`, `src/data/home/`, `src/hooks/home/`, `src/services/home/homeCollectionService.js` (`lirc_home_collection`), `src/layouts/public/` | `docs/PROJECT_GUIDE.md` |
| Dashboard, greeting, member cards, staff dashboard | `src/pages/PrivatePages/Dashboard/Dashboard.jsx` | `src/services/dashboard/dashboardService.js` (`lirc_my_dashboard`), `src/components/personnel/PersonnelDashboard.jsx`, `statisticsService.js`, `borrowService.js`, `finesService.js`, `useSemester.js`, `useAuth.js` | `tests/dashboard/`, `docs/PERSONNEL_DASHBOARD.md` |
| OPAC, catalog search, filters, pagination, book details, edit book, cover | `src/pages/PrivatePages/OPAC/OPAC.jsx` | `src/hooks/catalog/useCatalog.js`, `src/components/catalog/BookDetails.jsx`, `EditBook.jsx`, `CatalogDialog.jsx`, `BookCover.jsx`, `src/services/catalog/bookService.js`, `catalogQuery.js`, `bookValidation.js` | `tests/catalog/`, `docs/OPAC.md` |
| Word catalog cards, missing-field warning, download filtered books, card view | `src/pages/PrivatePages/OPAC/OPAC.jsx` | `src/services/catalog/bookCardDocx.js`, `bookCardValidation.js`, `bookService.getBooksForExport` | `tests/catalog/bookCardValidation.test.js` |
| Add book, add copies, accession numbers, ISBN lookup | `src/pages/PrivatePages/AddingBooks/AddingBooks.jsx` | `src/components/catalog/AddBookDialog.jsx`, `src/services/catalog/bookService.js`, `newBookRules.js`, migrations `20261012220000_add_book_workflow.sql`, `20261013090000_edit_book_copies.sql` | `tests/catalog/newBookRules.test.js`, `docs/ADDING_BOOKS.md` |
| Profile, avatar, library card, card PDF, validation proof | `src/pages/PrivatePages/Profile/Profile.jsx` | `src/components/profile/`, `src/services/profile/libraryCardModel.js`, `libraryCardPdf.js`, `src/services/validation/onlineValidationService.js`, storage `avatars` and `validation-proofs` | No direct profile test; use lint/build/manual route |

### Circulation and operations

| Request keywords | Read first | Supporting files / contract | Tests / docs |
| --- | --- | --- | --- |
| Borrowing page, loan, return, overdue, due date, records, circulation report | `src/pages/PrivatePages/BookBorrow/BookBorrow.jsx` | `src/components/borrow/`, `src/hooks/borrow/useLoanRecords.js`, `borrowService.js`, `loanRules.js`, `borrowReportService.js`, `borrowReportRules.js`; RPCs `lirc_borrow_*`, `lirc_return_loan`, `lirc_loan_records` | `tests/borrow/`, `docs/BORROW.md` |
| Reservation, hold, pickup, 1-hour hold, reservation queue | `src/pages/PrivatePages/BookBorrow/BookBorrow.jsx`, `src/pages/PrivatePages/MyBorrowing/MyBorrowing.jsx` | `src/components/borrow/ReservationQueue.jsx`, `MyReservationsPanel.jsx`, `ReservationCountdown.jsx`, `reservationService.js`, migration `20261108093000_book_reservations.sql` | `docs/BORROW.md` |
| Fine, unpaid balance, lost copy, settle fine, fines setting | `src/components/borrow/ReturnAction.jsx`, `BookLoanDialog.jsx`, `src/pages/PrivatePages/Settings/Settings.jsx` | `src/services/fines/finesService.js`, `fineRules.js`, `app_settings`, `library_fines`, RPCs `lirc_*fines*`, `lirc_flag_copy_lost`, `lirc_fine_settle` | `docs/BORROW.md`; no direct fine test file |
| My borrowing, my loans, my fines, my holds | `src/pages/PrivatePages/MyBorrowing/MyBorrowing.jsx` | `borrowService.js`, `reservationService.js`, `finesService.js`, `MyReservationsPanel.jsx`, `BookDetails.jsx` | `tests/borrow/` |
| Users, members, student/faculty records, edit member, add user, bulk CSV upload | `src/pages/PrivatePages/Users/Users.jsx` | `src/components/users/`, `src/services/users/userService.js`, `newUserRules.js`, `memberEditRules.js`, `personStatus.js`, `borrowService.js`, `finesService.js` | `tests/users/`, `docs/MEMBERS.md`, `docs/ADD_USER.md` |
| Barcode generator, barcode queue, templates, barcode Excel | `src/pages/PrivatePages/BarcodeGenerator/BarcodeGenerator.jsx` | `src/components/barcodes/`, `src/services/barcodes/barcodeService.js`, `barcodeRules.js`, `barcodeWorkbook.js` | `tests/barcodes/`, `docs/BARCODES.md` |
| Inventory, scan copy, missing copy, inventory history | `src/pages/PrivatePages/Inventory/Inventory.jsx` | `src/components/inventory/`, `src/services/inventory/inventoryService.js`, `inventoryRules.js`, `inventory_sessions`, `inventory_entries` | `tests/inventory/`, `docs/INVENTORY.md` |
| Attendance, scanner, time in/out, visit, purpose, attendance report | `src/pages/PrivatePages/Attendance/Attendance.jsx` | `src/components/attendance/`, `src/hooks/attendance/useAttendanceExport.js`, `src/services/attendance/attendanceService.js`, `attendanceRules.js`, `attendanceReportRules.js`, `reportFilters.js`; `attendance`, `student_enrollments` | `tests/attendance/`, `docs/ATTENDANCE.md`, `docs/STAFF_WORKSPACE.md`, `docs/FILTER_GUIDE.md` |
| Library validation, enrollment, annual validation, online validation proof/review | `src/pages/PrivatePages/Enrollments/Enrollments.jsx` | `src/components/attendance/EnrollmentForm.jsx`, `OnlineValidationReviewModal.jsx`, `src/components/profile/ProfileValidation.jsx`, `src/services/validation/onlineValidationService.js`, `attendanceService.js`, `library_validation_requests`, `enrollment_change_requests` | `docs/ATTENDANCE.md`, `docs/FILTER_GUIDE.md` |
| Academic periods, semester, school year, active period | `src/pages/PrivatePages/AcademicPeriods/AcademicPeriods.jsx` | `src/components/periods/PeriodForm.jsx`, `SemesterSelector.jsx`, `src/hooks/periods/useSemester.js`, `src/context/periods/SemesterProvider.jsx`, `src/services/periods/periodService.js`, `periodRules.js`, `semesters`, `academic_years` | `docs/ATTENDANCE.md`, `docs/FILTER_GUIDE.md` |
| System borrowing station, system attendance station | `src/pages/SystemStation/SystemStation.jsx` | `BorrowStation.jsx`, `AttendanceStation.jsx`, `src/services/system/systemStationService.js`, RPCs `lirc_system_borrow*`, `lirc_system_attendance*` | No direct tests; verify role and live station flow |

### Reporting, content and backend

| Request keywords | Read first | Supporting files / contract | Tests / docs |
| --- | --- | --- | --- |
| Statistics, counts, charts, borrower card, catalog/validation/attendance stats, drilldown | `src/pages/PrivatePages/Statistics/Statistics.jsx` | `src/components/statistics/`, `src/hooks/statistics/useStatisticsDetail.js`, `src/services/statistics/statisticsService.js`, `borrowTree.js`, `visitTree.js`, RPCs `lirc_statistics_*`, `lirc_my_statistics` | `tests/statistics/` |
| Path Finder, curriculum, subject recommendations, book suggestions, acquisitions | `src/pages/PrivatePages/PathFinder/PathFinder.jsx` | `src/hooks/pathfinder/usePathFinder.js`, `src/components/pathfinder/`, `src/services/pathfinder/pathFinderService.js`, `curriculumWorkbook.js`, `acquisitionWorkbook.js`, curriculum tables, `subject_recommendations`, `acquisition_suggestions`; DCI 10-year data: `supabase/migrations/20261122100000_dci_10_year_recommendations.sql` | No direct Path Finder test folder; verify build and flows |
| AI recommendations, Gemini, web grounding, AI findings | `src/components/pathfinder/AiRecommendModal.jsx` | `src/services/pathfinder/pathFinderService.js` (`runAiRecommendations`, `getAiFindings`), `supabase/functions/subject-recommendations/index.ts`, `subject_ai_findings` | No direct AI test; deployment is separate from Vercel |
| Announcements, announcement popup, announcement feed, announcement image | `src/pages/PrivatePages/Announcements/Announcements.jsx` | `src/components/announcements/`, `src/services/announcements/announcementService.js`, `announcements`, storage `announcement-images` | No direct test folder |
| Notifications, header bell, unread count, mark read | `src/context/notifications/NotificationProvider.jsx`, `src/pages/PrivatePages/Notifications/Notifications.jsx` | `src/components/layout/member/NotificationBell.jsx`, `src/services/notifications/notificationService.js` (`getNotificationUnread`), `notifications`, RPCs `lirc_notification_feed`, `lirc_notification_unread` | `docs/NOTIFICATIONS.md` |
| Settings, fines switch, daily rate | `src/pages/PrivatePages/Settings/Settings.jsx` | `src/services/fines/finesService.js`, `app_settings`, RPCs `lirc_settings_get`, `lirc_settings_set_fines` | `docs/BORROW.md`; no direct settings test |
| User logs, activity, personnel performance, monthly AI summary | `src/pages/PrivatePages/UserLogs/UserLogs.jsx`, `UserPerformance/UserPerformance.jsx` | `src/hooks/personnel/`, `src/components/personnel/`, `src/services/personnel/`, `activity_events`, `performance_reports`, `performance-summary` Edge Function | `tests/personnel/`, `docs/PERSONNEL_DASHBOARD.md` |
| Excel/Word/PDF export, download, report file | See **Export pipeline** below | Keep the existing generator and job; do not put long work in the page | Feature tests plus `tests/borrow/borrowReportWorkbook.test.js` etc. |
| Database, RPC, migration, RLS, grants, storage policy | `supabase/migrations/` + `docs/DATABASE_SETUP_STATUS.md` | Grep the exact RPC/table/prefix; read only the relevant function | Add/verify migration; update the database status doc |
| Deployment, Vercel, Netlify, Docker, CI | `docs/DEPLOYMENT.md` | `vercel.json`, `netlify.toml`, `.github/workflows/ci-cd.yml`, `scripts/deploy-*.mjs` | Build, inspect, live check |

## 3. Shared building blocks

| Area | Files | Use |
| --- | --- | --- |
| Auth state | `src/context/auth/AuthContext.jsx`, `src/hooks/auth/useAuth.js` | Current user, profile, role, login/logout/refresh |
| Login dialog | `src/context/login/`, `src/hooks/auth/useLogin.js` | Public-page login modal state |
| Semester | `src/context/periods/SemesterProvider.jsx`, `src/hooks/periods/useSemester.js` | User-scoped selected semester; persists per user |
| Notifications | `src/context/notifications/NotificationProvider.jsx`, `src/hooks/shared/useNotifications.js` | Feed/unread, visible-tab polling |
| Toasts | `src/context/toasts/`, `src/hooks/shared/useToast.js` | Success/error/info feedback |
| Dialogs | `src/context/dialogs/`, `src/hooks/shared/useDialog.js` | Confirm/discard/save choice dialogs |
| Scanner | `src/context/scanner/`, `src/hooks/shared/useScanner.js` | Shared scanner hotkey handling |
| Display/theme | `src/context/display/`, `src/context/theme/`, shared hooks | Layout density, dark/light theme |
| Common UI | `src/components/ui/` | `Modal`, `ActionDialog`, `Toast`, `Loading`, `Skeleton`, `Avatar`, `Reveal`, `DeferredRender` |
| Shared workspace UI | `src/components/attendance/WorkspaceUi.jsx`, `StaffUi.jsx` | Panels, notices, headers, table/input buttons |
| Manila/time rules | `src/services/attendance/attendanceRules.js` | `manilaDate`, `displayTime`, names, eligibility helpers |
| File download | `src/services/shared/fileDownload.js` | Blob download and safe filenames |
| Read cache | `src/services/shared/readCache.js` | In-memory TTL cache with in-flight deduplication; used for semesters and Path Finder reads |
| Supabase client | `src/lib/supabase/client.js`, `src/services/auth/authService.js` (`getSupabase`) | Shared client, auth/session and 20-second browser request deadline |

## 4. Service and data map

| Service folder | Main responsibility | Main RPC/table group |
| --- | --- | --- |
| `announcements/` | Feed, management, image upload | `lirc_announcement*`, `announcements` |
| `attendance/` | Scanner, visits, reports, validation history, export data | `lookup_attendance_card`, `lirc_attendance_*`, `lirc_enrollment_*`, `attendance`, `student_enrollments` |
| `auth/` | Session, login, profile, registration, password reset, avatars | `lirc_my_profile`, `lirc_set_my_avatar`, `usersData`, `avatars` |
| `barcodes/` | Queue, templates, barcode workbook | `lirc_barcode_*`, `barcode_entries`, `barcode_templates` |
| `borrow/` | Loans, returns, previews, member search, reservations, loan records, reports | `lirc_borrow_*`, `lirc_return_loan`, `lirc_loan_records`, `lirc_*reservation*`, `book_loans`, `book_reservations` |
| `catalog/` | Book reads/writes, copies, lookups, covers, validation, Word cards | `books`, `book_accession_numbers`, `book_formats`, `shelves`, `lirc_add_book`, `lirc_save_book_copies` |
| `dashboard/` | Manila greeting/date helpers | none |
| `fines/` | Fines settings, member fines, settle/lost copy | `app_settings`, `library_fines`, `lirc_*fines*` |
| `home/` | Public collection | `lirc_home_collection` |
| `inventory/` | Sessions, scans, review, history | `lirc_inventory_*`, `inventory_sessions`, `inventory_entries` |
| `notifications/` | Notification feed/read state | `lirc_notification_*`, `notifications` |
| `pathfinder/` | Curriculum, suggestions, AI, acquisitions, workbooks | `lirc_path_finder_*`, `lirc_acquisition_*`, curriculum tables |
| `periods/` | Academic years and semesters | `semesters`, `academic_years`, `set_active_semester` |
| `personnel/` | Activity logs, performance, AI reports | `lirc_activity_*`, `lirc_personnel_*`, `lirc_performance_*`, `lirc_sign_in_activity` |
| `profile/` | Library card model/PDF | no RPC; reads profile/model |
| `statistics/` | Overview, borrowing, attendance, members, borrowers, personal stats | `lirc_statistics_*`, `lirc_my_statistics` |
| `system/` | Shared station borrowing/attendance | `lirc_system_*` |
| `users/` | Member search, detail, add/edit, bulk import | `lirc_member_*`, `lirc_add_user`, `lirc_update_member`, `lirc_*user_import` |
| `validation/` | Online validation proof/request/review | `lirc_my_validation_status`, `lirc_online_validation_requests`, `lirc_submit_validation_request`, `lirc_review_validation_request`, `validation-proofs` |

Most protected workflow mutations go through `SECURITY DEFINER` RPCs. Some normal reads and storage calls use the Supabase client directly. When changing a guarded workflow, inspect both the service call and the RPC definition.

## 5. Database map

### Important table groups

| Group | Tables |
| --- | --- |
| Members/auth | `usersData`, `avatars`, `position_classifications` |
| Catalog | `books`, `book_accession_numbers`, `book_formats`, `shelves` |
| Periods/attendance | `academic_years`, `semesters`, `attendance`, `student_enrollments` |
| Validation | `library_validation_requests`, `enrollment_change_requests` |
| Circulation | `book_loans`, `book_reservations`, `library_fines`, `app_settings` |
| Barcode/inventory | `barcode_entries`, `barcode_templates`, `inventory_sessions`, `inventory_entries` |
| Path Finder | `curriculum_programs`, `curriculum_subjects`, `curriculum_entries`, `gen_ed_subjects`, `subject_recommendations`, `subject_ai_findings`, `acquisition_suggestions` |
| Communication/audit | `announcements`, `notifications`, `activity_events`, `performance_reports`, `security_events`, `provenance_batches` |
| Account setup | `registration_tokens`, `password_reset_requests` |

### Migration rules

- Migrations live in `supabase/migrations/` and are named `YYYYMMDDHHMMSS_description.sql`.
- The current ledger contains 128 files at this scan.
- Some earliest base tables were created outside the migration ledger. Do not assume a table does not exist just because no migration creates it; check the live database or `docs/DATABASE_SETUP_STATUS.md`.
- Some migration-created tables are later dropped or replaced. The migration history is not the current schema by itself.
- `book_loans_sample_backup`, goal tables (`work_goals`, `goal_*`) and their RPCs are legacy/demo material unless the current UI or docs say otherwise. Do not build new work on them without checking the live status.
- Every new database change should:
  1. add a new migration;
  2. verify the RPC/table contract;
  3. record the applied migration in `docs/DATABASE_SETUP_STATUS.md`;
  4. update this map if a feature or data source changed.

### Supabase internal rules

- `lirc_private` is not exposed through the API and holds trusted helpers.
- Public `lirc_*` functions are the normal client contract.
- RLS and grants are the real security boundary. A hidden browser button is not a permission check.
- Avoid service-role usage in the browser; use an Edge Function when a trusted server secret is needed.

### Storage buckets

| Bucket | Visibility | Limits | Used by |
| --- | --- | --- | --- |
| `book-covers` | public read | WebP, max 512 KB | Catalog covers |
| `avatars` | public read | PNG/JPEG/WebP, max 2 MB | Profile avatars |
| `announcement-images` | public read | WebP, max 512 KB | Announcements |
| `validation-proofs` | private | PNG/JPEG/WebP/PDF, max 5 MB | Online validation |

## 6. Edge Functions

| Function | Purpose | Key tables/client |
| --- | --- | --- |
| `registration` | Email-link identity claim and account creation | `registration_tokens`, `usersData`, `lirc_email_has_account` |
| `request-password-reset` | Trusted reset-email request | `password_reset_requests`, Auth email |
| `provision-accounts` | Trusted bulk account provisioning | `usersData`, `position_classifications` |
| `subject-recommendations` | Gemini-backed Path Finder recommendations | curriculum tables, `books`, `subject_recommendations`, `subject_ai_findings` |
| `performance-summary` | AI monthly personnel summary | `lirc_performance_ai_input`, `usersData`, `performance_reports` |

- Function settings are documented in `supabase/functions/.env.example`.
- Edge Functions are deployed separately from the Vercel frontend.
- AI web grounding is opt-in via `GEMINI_WEB_ENABLED`; the default is catalog-only for speed unless the environment says otherwise.

## 7. Export pipeline

| Export | Entry point | Builder/job | Verification |
| --- | --- | --- | --- |
| OPAC Word catalog cards | `OPAC.jsx` download action | `src/services/catalog/bookCardDocx.js`, `bookCardValidation.js`; client-side Office Open XML | `tests/catalog/bookCardValidation.test.js`; check card/page count and missing modal |
| Attendance Excel | `ReportExport.jsx` + `useAttendanceExport` | `attendanceExportJob.js`, `attendanceReportWorkbook.js` | `tests/attendance/`; check sheets and highlighted group rows |
| Book Borrow Excel | `BorrowReportPanel.jsx` + `useBorrowExport` | `borrowExportJob.js`, `borrowReportWorkbook.js` | `tests/borrow/borrowReportWorkbook.test.js` |
| Barcode Excel | `barcodeService.downloadBarcodeFile` | `barcodeWorkbook.js` | `tests/barcodes/barcodeWorkbook.test.js` |
| Path Finder curriculum/acquisition Excel | `CurriculumPanel.jsx`, `AcquisitionsPanel.jsx` | `curriculumWorkbook.js`, `acquisitionWorkbook.js` | Build + manual export check |
| Library card PDF | `Profile.jsx` | `libraryCardPdf.js`, `libraryCardModel.js` | Build + manual check |
| Personnel performance PDF | `MonthlySummaries.jsx` | `performanceReportPdf.js`, `performanceReportRules.js` | `tests/personnel/performanceReportRules.test.js` |

Long-running attendance and borrow exports use module-level jobs so navigating away does not cancel the download. Preserve that pattern.

## 8. Test map

Tests are plain Node tests and do not hit the live Supabase project.

| Folder | Covers |
| --- | --- |
| `tests/attendance/` | attendance rules, report rules, scanner hotkey |
| `tests/auth/` | password rules |
| `tests/barcodes/` | barcode rules and workbook |
| `tests/borrow/` | loan rules, member search, borrow report workbook |
| `tests/catalog/` | catalog queries, cover validation, new-book rules, card validation |
| `tests/dashboard/` | dashboard rules |
| `tests/inventory/` | inventory rules |
| `tests/personnel/` | activity descriptions, performance rules, report rules |
| `tests/routes/` | route access |
| `tests/shared/` | read cache TTL, in-flight deduplication, invalidation |
| `tests/statistics/` | borrow and visit drill trees |
| `tests/users/` | member edit rules, new-user rules, person status |

Run all with `npm test`. The current baseline is 134 passing tests.

## 9. Known traps and invariants

1. **Shared promise + caller abort**: never tie a shared in-flight settings/lookup promise to one component's `AbortSignal`. A remount can abort every consumer and surface a false error. This caused the earlier OPAC lookup and Settings/fines failures.
2. **StrictMode effects**: development mounts effects twice. Abort-aware effects must ignore `AbortError` and stale responses.
3. **Role drift**: `ACCESS.attendance` currently includes staff, despite an older ATTENDANCE doc statement. Confirm the page and RPC before changing access.
4. **Vercel is not automatically implied by a push**: use the documented Vercel CLI/script path and verify the live deployment. Netlify has a separate GitHub Actions deploy.
5. **Edge Functions are separate**: a committed `subject-recommendations` or `performance-summary` change does not go live with Vercel.
6. **Migrations are append-only**: do not edit an applied migration; add a new one and record it.
7. **Core schema history**: some base tables are outside the migration ledger; live schema and `DATABASE_SETUP_STATUS.md` are more reliable for existence than the migration file list.
8. **Catalog exports read all filtered rows**: `getBooksForExport` batches the current filter query. Do not change it to only the visible page or filter the whole catalog in the browser.
9. **OPAC card fields**: validation covers title, author, call number, ISBN, publisher, publication year and subject/section-or-format. Notes are optional; edition/place of publication are placed in the notes area when present.
10. **Settings cache**: `getSettings` is read by several dialogs and the Settings page. Saving must clear the cache, and the shared read must stay abort-safe.
11. **Manila time**: use `attendanceRules` helpers for dates and day boundaries instead of `new Date()` formatting in components.
12. **Book edits use optimistic concurrency**: the book `updated_at` is part of the update contract. Do not remove that check.
13. **VITE variables are public**: never put a service role or secret in a `VITE_` variable.
14. **Display name/member records**: use the existing RPCs for member display data; do not add direct `usersData` reads/writes for staff flows without checking policies.
15. **Client request amplification**: notifications poll an unread count (not the full feed); semesters and Path Finder reads are cached. Preserve jitter, visibility pause and bounded polling when changing these paths. See `docs/LOAD_RESILIENCE_PLAN.md`.

## 10. Adding a new feature

1. Add the route in `src/App.jsx`.
2. If it appears in the signed-in sidebar, add it to both `src/routes/memberPages.js` and `src/routes/memberScreens.js`; use `ACCESS` groups for roles.
3. Add the page under `src/pages/PrivatePages/<Feature>/` (or `PublicPages`).
4. Put feature components under `src/components/<feature>/`, behavior under `src/hooks/<feature>/`, and data access under `src/services/<feature>/`.
5. Add or reuse shared UI only when the piece is genuinely used across features.
6. If the feature changes database state, add an RPC/migration with an explicit role guard and tests.
7. Add the feature to the **Request router** and **Service and data map** here.
8. Add a change-log entry and any feature doc.

## 11. Map maintenance

### Update this map when

- a route/page/feature folder is added, removed or renamed;
- a hook or service moves;
- an RPC/table/storage bucket/Edge Function is added or renamed;
- access rules change;
- the data flow changes (new cache, context, job or export path).

### Do not update the full map when

- only copy, spacing, styling or a local calculation changes;
- only a test is added;
- a bug fix stays inside the already-mapped files;
- a migration is applied without adding a new feature or data source.

Record every change in `docs/CHANGE_LOG.md`, including `Map updated: no` when the map did not change.

### When the map is stale

If a mapped path is missing, the route no longer exists, or the RPC name changed:

1. Find the replacement with a targeted grep.
2. Fix the map in the same change.
3. Add the reason to the change log.
4. Do not silently keep using an obsolete path.

### Full scan policy

A full scan is justified only for a missing feature, a cross-cutting change, an untraceable failure, an access/security review, or an explicit user request. After a full scan, update this map and the change log so it does not have to be repeated.

### Documentation check

Run `node scripts/check-agent-docs.mjs` after changing this map or the agent docs. It verifies local links, mapped paths and that every current route is listed above.
