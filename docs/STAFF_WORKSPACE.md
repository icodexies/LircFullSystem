# Staff page layout

Attendance, Annual enrollment and Academic periods use the same simple structure:

1. A navy header explains the page and holds its main action.
2. Summary cards show the important numbers.
3. A white records panel groups its toolbar, filters and results.
4. Forms open in modal windows, keeping the main page focused on records.

## Annual enrollment

Click **Validate / update** beside a student to open their form. **Save validation** opens a second confirmation with Save validation and Cancel. Cancel returns to the filled form without saving. A successful save shows a success message, closes the form and refreshes the list. An error keeps the form available for correction.

Validation covers the academic year, including both semesters. It does not record attendance. Verified enrolled levels remain 1–4.

## Academic periods

- **+ New semester** opens the semester creation form.
- **+ Academic year** opens the school-year creation form.
- **Edit semester** opens that semester's details.
- **Manage academic years** opens the calendar list. **Edit calendar dates** opens the selected year's form; Cancel returns to the calendar list.

Each form asks for confirmation before saving. Creating or editing a semester does not activate it. **Make active** is a separate action with its own warning and confirmation.

## Attendance

**Open scanner** opens a window for card lookup and recording visits. Lookup is still separate from recording time in or time out. Cross-semester open visits have their own expandable panel, so older visits can be closed without mixing them into the selected semester's report.

## Small screens and performance

Summary cards use two columns on phones. Controls wrap, forms scroll within the screen and wide tables scroll horizontally inside their records panel. Advanced filters and long notes stay collapsed until needed.

The pages share `WorkspaceUi.jsx`, and period forms share `PeriodForm.jsx`. Existing server pagination, report filtering, request cancellation, role restrictions and database validation are preserved. No animation library or production dependency was added.

## Checks

Verified the desktop and phone attendance/enrollment layouts, semester creation and editing, calendar edit forms, separate Save/Cancel confirmations and successful refreshes using an isolated demo client. These browser checks did not modify live records. All 27 existing tests, lint and the production build pass.
