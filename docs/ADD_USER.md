# Adding users

The **Users** page has an **Add User** button (top right of the navy banner;
**admin only** — staff and librarians see the page without it).
It opens a window with two tabs — **Individual** and **Bulk CSV Upload** —
that follow the same rules. The database checks everything again on save, so
the two methods can never drift apart.

## Individual

1. Fill the form. Required: **Library ID**, **First name**, **Surname** and
   **Role**. Middle initial and suffix may be blank.
2. **Department / Program / Position classification** come from your existing
   records. Students see **Program**; everyone else sees **Position
   classification**.
3. **Admin** appears in the role list only for admins.
4. **Students** also get an **Library validation** section:
   - Pick the **academic year** (past years are handled on the Annual
     enrollment page).
   - **Year level**: leave blank for new students — the level is set from the
     library card when the enrollment is validated (card 26-… in 2026 → 1st
     year). Type a level for **irregular or continuing students**; a typed
     level is kept, even when validated.
   - Librarians and admins may tick **Validate this enrollment now**; without
     it the record is saved as **Unverified**. Plain staff can only save
     Unverified — validating needs a librarian or admin.
5. **Save User** — the profile (and the enrollment) save together. If the
   library ID already exists, the form shows *"This library ID already belongs
   to a user."* and keeps everything typed.
6. After saving, choose **Add Another** or **Close**. The member list
   refreshes.

## Bulk CSV Upload

1. **Download a template** — *Student* or *Personnel*. Columns are the exact
   database names: `library_id, first_name, surname, middle_initial, suffix,
   role, department_id, program_id, position_classification_id` (students
   also get `year_level` and `year_level_note`). There are no `id` or
   `user_id` columns — the system creates those.
2. The screen shows the **ID reference lists** (departments, programs,
   position classifications) straight from the database, plus the role
   values.
3. Fill one row per person, save as **CSV UTF-8**, and keep library IDs as
   text so leading zeros stay.
4. Choose the **academic year** for student rows (it applies to the whole
   file), then upload the file. **Uploading only checks — nothing is saved.**
5. The preview lists every row: *Ready* or *Problem* with the reason —
   missing required fields, repeated library IDs inside the file, library IDs
   already in the database, invalid roles or reference IDs, invalid year
   levels. Example: *Row 8: Program ID 99 does not exist.*
6. **Download error report** gives a CSV with row numbers and reasons.
7. When every row is ready, press **Import Users**. The database re-checks
   permissions and duplicates, then saves. Result: *"98 users added, 2
   failed."* with the failed rows listed. Successful rows stay saved;
   re-uploading the same file never adds them twice (they show as *"This
   library ID already belongs to a user."*). Student rows are saved as
   **Unverified**; validation is a separate action.

## Rules (same for both methods)

| Check | Where |
| --- | --- |
| Library ID, first name, surname required; lengths limited | form + `lirc_private.clean_new_member` |
| Library ID unique (case-insensitive) | database |
| Role valid; admin only by admins | `clean_new_member` |
| Reference IDs must exist | `clean_new_member` |
| Students: year level 1–4 when typed | `clean_new_enrollment` |
| Manual year levels are kept; blank ones derive from the card | `guard_student_enrollment` |
| Unverified rows: any library operator; validating: admin/librarian | `guard_student_enrollment` |
| Past school years need approval | `guard_student_enrollment` |
| Retry-safe imports (no duplicates on re-upload) | `lirc_import_users` |

## Files

| File | Job |
| --- | --- |
| Migration `20261013160000_add_user.sql` | Manual-level support + `lirc_add_user`, `lirc_check_user_import`, `lirc_import_users` |
| Migration `20261013170000_fix_add_user.sql` | Academic year validation fix |
| `src/services/users/newUserRules.js` | Pure rules (form mirror, CSV reader, templates, error report) |
| `src/services/users/userService.js` | `addUser`, `checkUserImport`, `importUsers` |
| `src/components/users/AddUserDialog.jsx` | The window with both tabs |
| `src/components/users/AddUserForm.jsx` | Individual tab |
| `src/components/users/BulkUserUpload.jsx` | Bulk CSV tab |
| `src/pages/PrivatePages/Users/Users.jsx` | Add User button + list refresh |

## Testing it

1. Users → **Add User** → fill a student with no year level → Save → the
   success panel appears; the member search list refreshes.
2. Add the same library ID again → *"This library ID already belongs to a
   user."*
3. Add a student with year level 2 (irregular) → the enrollment stores 2 and
   keeps it when validated; without a level, validating sets it from the
   card.
4. Bulk tab → download the student template → fill a few rows (include a bad
   program ID and a repeat) → upload → the preview shows the problems and
   **Download error report** works → fix them → **Import Users** → the result
   counts appear. Upload the same file again → everything is flagged as
   already existing.
