# The Users page

The **Users** page (`/users`, for staff / librarian / admin) is the member
record: search a person, see everything about them, and edit their details
directly. Every edit is recorded in the activity log (who changed what, with
the old and new values).

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
fields and appears as a badge on the member record, under the borrower's name
in the Borrowed / Overdue / Returned lists and the borrow Report tab, and as a
**Person status** column in the Excel report — so an overdue book can be
traced to someone who has left the school or passed away.

## Editing member details

Editable fields: **first name, surname, M.I., suffix, department, program,
position, person status**. Role, library card and account links are locked.

1. Open a record → **Edit details** → change the fields → **Apply edit**.
   The edit is saved immediately for staff, librarian and admin.
2. The activity log records the change with the actor, the field, and the old
   and new values. The Pending / Approved / Rejected tabs keep earlier
   approval requests; an admin can still approve any older pending request.
3. Only real changes are sent (a field that did not change is not saved).

## Tabs

| Role | Tabs |
| --- | --- |
| Staff / librarian | Member details · Pending / Approved / Rejected requests (history of their earlier requests) |
| Admin | The same four tabs over every request: approve/reject inside the Pending window; Approved and Rejected list the reviewed history |

## Database (migration `20261012180000_member_edits.sql` + `20261021130000_staff_edit_access.sql` + `20261021140000_activity_member_fields.sql`)

| RPC | Purpose |
| --- | --- |
| `lirc_member_profile(profile)` | Details + counts + person status |
| `lirc_member_attendance(profile)` | Visit history (latest 100) |
| `lirc_member_options()` | Department/program/position lists (operators) |
| `lirc_request_member_change(profile, changes)` | Staff/librarian/admin: validates and saves the edit now |
| `lirc_member_change_requests(only_mine)` | Lists earlier requests (admins: all; staff: their own) |
| `lirc_review_member_change(request, approve)` | Admin approves/rejects an older pending request + notifies the requester |

Validation mirrors on both sides: required names, length limits, only real
changes, classification ids must exist, and the person status must be one of
the six allowed values (or empty). The activity log covers role, card,
department, program, position, name parts and person status.

## Files

`src/pages/PrivatePages/Users/Users.jsx` (tabs + deep links) ·
`src/components/users/MemberDetails.jsx`, `MemberEditForm.jsx`,
`MemberRequestModal.jsx` · `src/services/users/userService.js`,
`memberEditRules.js` · tests in `tests/users/`.

## Testing it

1. As a staff or librarian: Users → search a student → **Edit details** →
   change the program → **Apply edit** (a toast confirms and the record
   updates immediately).
2. Open User Logs (admin) and confirm the edit appears with the staff member
   as the actor and the old → new value.
3. An older pending request, if any, still opens from the Pending tab and can
   be approved or rejected by an admin.
