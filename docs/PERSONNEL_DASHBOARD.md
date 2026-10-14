# Personnel Dashboard — activity tracking (v1)

Status: **live on 14 October 2026.** The library personnel dashboard
(admin / librarian / staff) is **activity-focused**: it shows what each
person does, from the append-only activity log.

> **The goal system was removed entirely** (tables, RPCs and dashboard
> sections) on 14 October 2026 — it is not part of the website. The few
> historical goal events stay visible in the log as plain sentences (history
> is never deleted), but nothing creates goals anymore.

## What the dashboard shows

- **Stat cards (four, all new facts — no repetition):** Actions recorded
  (30 days), Active days (X of 30), Current streak (consecutive active days),
  Busiest day (date + count).
- **Actions per day** — a bar chart of your recorded actions over the last 30
  days (Philippine-time days, zero days shown, today highlighted; hover a bar
  for the exact count).
- **Where your work goes** — a donut of your actions by kind (inventory,
  borrowing, members, member changes, enrollment, catalog, attendance,
  academic periods, barcode, other) with counts and percentages. This chart
  is the *only* place the type breakdown appears.
- **Your activity** — your own actions only, with filter chips (hover a chip
  to see what it covers), "load more" (keyset paging) and links to the
  managing page. The everyone view lives on the admin User logs page.
- **Your sign-ins** — when your account opened the system. Until the
  Supabase dashboard toggle *"Write audit logs to the database"* is enabled
  this reads session records only and says so, with coverage dates.

Everything the earlier sample dashboard showed (trend charts, activity
heatmap, "team average", "active rate") was removed rather than wired to
invented numbers. The student/faculty dashboard is unchanged.

## User logs page (admin only)

`/user-logs` (sidebar: Members group) lists **every recorded action by every
person** — staff, librarians, admins, and member-related work — with
numbered pages (Previous/Next, page X of Y, total count). Filters:

- **Show** — chips for every kind of work in the system: Inventory,
  Borrowing, Members (add/edit/import), Member changes (requests &
  approvals), Enrollment (library validation), Catalog (books & copies),
  Attendance, Academic periods, Barcode. Each chip matches several action
  families at once and explains itself on hover.
- **Person** — search by name: every typed word must appear in the person's
  name (any order), and close spellings are matched too ("dla cruz" still
  finds Dela Cruz).
- **When** — limit to a date and time range, entered in Philippine time
  (blank means everything).
- **Who** — the role of the person (admin, librarian, staff, faculty,
  student, non-teaching personnel).
- **Source** — how the change happened, spelled out in the option itself:
  *In the app — someone used a screen*, *Automatic follow-up — the system
  did it by itself*, *Direct table edit — changed outside the app screens*,
  *Migration — from setup or repair scripts*.

A helper line under the filters explains all three in plain words. Each row
shows the time, who (with role), the concrete sentence, the source and an
"Open" link to the managing page.

Every number and sentence comes from the database; nothing is computed or
invented in the browser.

## User performance page (admin only)

`/user-performance` (sidebar: Members group) summarizes **one library person
at a time** for evaluation — librarians, staff and admins, the roles that work
in the library system. A dropdown lists every such person; the selected one
shows:

- The same four stat cards as the personal dashboard: Actions recorded (30
  days), Active days, Current streak and Busiest day.
- **Actions per day** — their 30-day bar chart (Philippine-time days, hover
  for exact counts).
- **Where the work goes** — their actions by kind with counts and shares.
- Their role, library ID and **last recorded action** date.

This is deliberately a summary, not a full audit — the User logs page has the
every-action view with person search. All numbers come from the same
server-side aggregation the personal dashboard uses
(`lirc_private.activity_summary_for`).

## What records what

- **`activity_events`** (append-only, server-attributed): every write to the 12
  tracked tables is captured by triggers. Actor is derived from `auth.uid()`
  inside the database — never passed in. `source` says how it happened:
  `app` (inside an RPC), `auto` (side effect of an operation), `direct_table`
  (SQL console/manual), `migration`. `operation_id` groups everything one user
  action wrote.
- **`security_events`** (admin read only): denied attempts. Because PostgreSQL
  rolls a transaction back when it raises, a denial cannot be logged from
  inside the failing call; the guarded `lirc_report_security_event` RPC lets
  the app report what it caught (frontend wiring is a future task).
- **`provenance_batches`** + `provenance` columns: every historical data set
  is labelled (`live`, `demo`, `seed`, `setup`, `import`, `unknown`) with its
  exact criteria and row counts. Nothing was deleted; uncertain rows stay
  `unknown` until you confirm them.

## Read RPCs in use

`lirc_activity_feed` (own / all for admins), `lirc_activity_log_page`
(admin, numbered pages), `lirc_activity_my_summary` (dashboard cards),
`lirc_personnel_performance_people` / `lirc_personnel_performance` (admin
User performance page), `lirc_sign_in_activity`, plus `lirc_activity_trace` /
`lirc_activity_for_entity` for record-level investigations.

## Next (optional)

- Flip *"Write audit logs to the database"* in Supabase for richer sign-in
  history (logouts, denied attempts).
- Search inside the User logs page, if the log grows large.
- The student/faculty dashboard still shows sample data — untouched by
  design so far.
