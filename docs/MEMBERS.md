# The Users page

The **Users** page (`/users`, for staff / librarian / admin) is the member
record: search a person, see everything about them, and edit their details
through admin approval.

## What a member record shows

- **Details** — name, library card, role, department, program, position,
  person status, whether an online account is linked, recorded visits and loan
  counts.
- **Borrow history** — every book they borrowed (active and returned),
  with copy accession numbers and dates.
- **Attendance history** — the latest 100 recorded visits (time in/out,
  purpose, semester, duration).

## Person status

An optional classification (nullable) that mainly covers school personnel who
can no longer be reached: **Active, On leave, Retired, Resigned, Separated or
Deceased** — or **Not specified**. Students keep their enrollment status, but
the field is available to flag anyone (for example a deceased student) and is
never required.

The status is saved through the same **Edit details** workflow as the other
fields (admins apply immediately; staff/librarian edits go for approval) and
appears as a badge on the member record, under the borrower's name in the
Borrowed / Overdue / Returned lists and the borrow Report tab, and as a
**Person status** column in the Excel report — so an overdue book can be
traced to someone who has left the school or passed away.

## Editing with approval

Editable fields: **first name, surname, M.I., suffix, department, program,
position, person status**. Role, library card and account links are locked.

1. Staff/librarian opens a record → **Edit details** → change fields →
   **Submit for approval**. The changes are stored as one request (only the
   fields that really changed; one pending request per member).
2. Every admin gets a **notification**; clicking it opens
   `/users?request=<id>` — the exact request window on the Users page.
3. The admin reviews the old → new diff and **Approves** (the record is
   saved) or **Rejects** (nothing changes).
4. The requesting staff member is **notified** of the outcome; the bell
   opens the same request window read-only.
5. An **admin's own edits apply immediately** (they are the approver).

## Tabs

| Role | Tabs |
| --- | --- |
| Staff / librarian | Member details · Pending requests · Approved requests · Rejected requests (their own requests) |
| Admin | The same four tabs over every request: approve/reject inside the Pending window; Approved and Rejected list the reviewed history |

## Database (migration `20261012180000_member_edits.sql` + `20261012181500_member_options.sql` + `20261021110000_person_status_and_today_counts.sql`)

| RPC | Purpose |
| --- | --- |
| `lirc_member_profile(profile)` | Details + counts + person status |
| `lirc_member_attendance(profile)` | Visit history (latest 100) |
| `lirc_member_options()` | Department/program/position lists (operators) |
| `lirc_request_member_change(profile, changes)` | Admin: applies now. Staff/librarian: creates the request + notifies admins |
| `lirc_member_change_requests(only_mine)` | Lists requests (admins: all; staff: their own) |
| `lirc_review_member_change(request, approve)` | Admin approves/rejects + notifies the requester |

Requests live in `public.member_change_requests` (RLS locked; RPC-only).
Validation mirrors on both sides: required names, length limits, only real
changes, classification ids must exist, and the person status must be one of
the six allowed values (or empty).

## Files

`src/pages/PrivatePages/Users/Users.jsx` (tabs + deep links) ·
`src/components/users/MemberDetails.jsx`, `MemberEditForm.jsx`,
`MemberRequestModal.jsx` · `src/services/users/userService.js`,
`memberEditRules.js` · tests in `tests/users/`.

## Testing it

1. As a librarian: Users → search a student → **Edit details** → change the
   program → Submit for approval (a toast confirms; the Pending tab shows it).
2. As an admin: the bell shows *Member edit request* → click it → the
   request window opens with the diff → **Approve** → the record updates.
3. Back as the librarian: the bell shows the result; the tab moved it to
   *Approved*.
