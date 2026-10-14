# Library filter guide

A filter narrows a list. It does not edit a student, book or visit. Leave a field blank or choose **All** when you do not need it. When you choose several filters, a result must match all of them.

Start with Search and Status. Open **Advanced filters** only when you need a more specific report. Click a filter chip's × to remove that one filter, or **Reset** to start again. The page also has a **How filters work** information alert in the top-right corner.

## How searching works (all pages)

- Searches ignore uppercase/lowercase and match any part of a word.
- **Several words work in any order**: every word must appear somewhere in
  the field you are searching. Typing `mark ian dagos` finds *Mark Ian D.
  Dagos* — the middle initial between the words no longer blocks the match.
- **Member searches** (Users page and the borrow card lookup) also fall back
  to **similar names** when nothing matches exactly, so small typos still
  find the person.
- `%`, `_` and `\` are searched as normal text, not wildcards.

## Semester selector in the header

| Choice | Meaning |
| --- | --- |
| Academic year · Semester | The period you want to view. Attendance shows visits from that semester. Library validation uses its academic year, so both semesters of one year share the same validation records. |
| Active label | The semester currently used for new time-ins by all operators. Choosing a different viewing semester does not change it. Only **Make active** in Academic periods changes it, after confirmation. |

Books are not filtered by semester. Time-out can close an existing visit from an older semester.

## OPAC: finding books

| Control | Meaning / example |
| --- | --- |
| Search by: Title | Find text within a book title. |
| Author | Find text within the author name. |
| ISBN | Find a book's ISBN, preserving its leading zeros. |
| Call number | Find its library classification / shelf code. |
| Accession number | Find a physical copy's accession number. The result shows the matching book once, even if several of its copies match. |
| Material format | Choose a type of material from the configured list. |
| Section / shelf | Show books assigned to that library section. |
| Publication year | Exact year the book was published, not its accession year. |
| Apply filters | Applies format, section and publication year together. Search updates after a short pause while typing. |
| Clear filters | Clears search and the selected refinements. |
| Sort: Title | Alphabetical title order. |
| Newest | Most recently added book records first. |
| Publication year | Latest publication years first; unknown years come last. |
| Results per page | Show 10, 20 or 50 books per page. This changes the amount displayed, not the matching books. |

**Example:** choose Accession number and type the copy number on the book label. For a broader search, choose Title and enter part of its title — several words work in any order, so `code clean` finds *Clean Code*.

Book department was removed from OPAC. A person's department still exists in attendance and student reports because it describes the person, not the book.

## Search shared by attendance and library validation

| Control | Meaning |
| --- | --- |
| Search by | Select Full name, Library ID, First name, Surname, Middle initial or Suffix. |
| Search | Enter part of the value. Search ignores uppercase/lowercase and several words work in any order. It only searches the field selected above. |
| Sort | Changes row order, without changing which rows match. |
| Order | Choose the direction: A → Z / oldest first, or Z → A / newest first. Empty values appear last. |

## Attendance: visit filters

These filters normally work within the semester selected in the header. Every date and time uses Philippine time (Calamba / Manila).

| Filter | Meaning / when to use it |
| --- | --- |
| Visit status: Still inside | The visitor has a time-in but no time-out yet. They are recorded as inside. |
| Checked out | The visit has both a time-in and time-out. |
| Visitor type | The role saved when that visit began, such as student, faculty or guest. Later profile changes do not rewrite it. |
| Year level at visit | The student's confirmed year level saved when they entered. **Not a student** is for visitors who are not students. New student visits require level 1–4. |
| Department | The person's department now. **Unassigned** means their profile has no department. |
| Program | The person's current course/program. Unassigned means none is recorded. |
| Position | The person's current employee position/classification. Unassigned means none is recorded. |
| Purpose | The library's list: Study, Research, Borrow Books, Return Books, LOA, EXIT CLEARANCE, INTERVIEW, THESIS, OJT, or Others. Others includes custom purposes entered by staff. |
| Purpose contains | Find words in a saved purpose, for example `thesis`. |
| Visit date from / to | Show visits whose date falls in this range. Both dates are included, Philippine time. |
| Arrived at or after / at or before | Time of day of arrival, for example 08:00 and 12:00. This applies on every date in the selected range. The range must not cross midnight. |
| Time-in recorded by | The librarian/admin who recorded time-in. |
| Time-out recorded by | The operator who recorded time-out. **No time-out yet** finds visits with no recorded checkout operator. |
| Student status now | The student's enrollment status now, in the school year of that visit. It can change after the visit. It does not rewrite the visit's saved year level. Not a student means a nonstudent. |
| Today | Sets both visit dates to today (Philippine time). It keeps your other filters and viewing semester. A past semester can therefore show no results. |
| Whole semester | Sets the visit dates to that semester's start and end. Keeps your other filters. |

Attendance sort choices: Time in, Time out, Date recorded, Year level, Library card, or Name.

**Examples:**

- Who is inside now? Select the active semester and Visit status **Still inside**.
- Which students visited today? Choose Visitor type **Student**, then **Today**.
- Which visits happened last week? Set Visit date from / to, then press Apply filters.

### Attendance summary

| Number / list | Meaning |
| --- | --- |
| Total visits | Matching visit records. One person visiting three times counts as three visits. |
| Unique visitors | Different people in those matching visits. That person counts once. |
| Inside | Matching visits that have no time-out. |
| Average duration | Average minutes for completed matching visits only. Open visits are excluded. |

## Annual student validation filters

This list includes current student profiles even when they have no library validation record. It uses the academic year of the selected semester.

| Filter | Meaning / when to use it |
| --- | --- |
| Annual status: Enrolled | Recorded as enrolled for that academic year. Time-in also needs a validation saved in the current year; the system sets the year level. Old records marked enrolled with an invalid level still need review. |
| Not verified | Enrollment has not been confirmed. A missing annual record is treated as unverified. |
| On leave | Confirmed temporary leave. |
| Withdrawn | Confirmed withdrawal. Use this status for a confirmed dropout when that is your school's recorded classification; record a reference. |
| Graduated | Confirmed graduation. |
| Card year prefix | The first two digits of a supported `YY-…` library ID. Enter `23` to find cards beginning `23-`. It is not a verified year level. |
| Department / Program | The student's current department/course. Unassigned means none is recorded. |
| Estimated level (from card) | A suggestion from admission year and academic-year start, limited to 1–4. **Unavailable** means the card cannot give a valid suggestion. It never decides enrollment status. |
| Validation state: No record | No enrollment row exists for this student/year. |
| Not verified yet | A row exists, but has no validation timestamp. |
| Validated | A validation timestamp exists and the record does not have an invalid enrolled year level. This can include confirmed inactive statuses. |
| Needs year-level review | An existing enrolled record has no valid level from 1–4. |
| Validated from / Validated to | Dates when staff saved the confirmation, including both dates in Philippine time. |
| Validated by | The librarian/admin who last confirmed the record. |
| Has login account: Yes / No | Whether the profile is connected to an online login account. A student does not need an online account for card attendance. |

Annual sort choices: Name, Library card, Year level, Status, Date validated, Date added, Last updated.

**Examples:**

- Find the old level-5 records: Validation state → **Needs year-level review**.
- Find students needing a new-year check: choose the new academic year, Annual status → **Not verified**.
- Find IT students confirmed this week: select Program, then set the validated dates.

### Why the old system showed level 5

The old initial setup used `academic-year start − admission year + 1`. A `22-…` card in 2026 produced 5. Years since admission do not tell us someone's actual year level or whether they withdrew.

The current system computes levels **1–4** for enrolled students from the library card and recorded leave years. Values outside this range display **Unavailable**, rather than being changed automatically. Legacy enrolled values outside 1–4 display **Needs review**, are counted separately, and cannot start a new visit; saving the record again lets the system set the level. Existing data and attendance history remain intact; historical exports retain the stored value and include `needs_review` for validation records.

Annual summary: **total** is all matching students; **validated** is confirmed records without an invalid enrolled level; **unverified** is students whose status is unverified; **needs review** is invalid enrolled levels. Validation does not always mean currently enrolled: a confirmed withdrawal is also a validated record.

## Academic periods filters

| Filter | Meaning |
| --- | --- |
| Academic year | Show semesters belonging to that year. |
| Semester name | Find part of a semester's name. |
| Global activation: Active / Inactive | Whether the semester is the one globally selected for new transactions. |
| Calendar date state: Upcoming | Its start date is after today in Philippine time. |
| Current | Today falls inside its dates, including start and end dates. |
| Ended | Its end date is before today. |
| Reset period filters | Clear these list filters. Does not change the active semester. |

**Active** and **Current** mean different things. A semester can be active even if its configured dates are wrong; new time-ins will then be blocked until staff corrects the calendar.

## Exporting a filtered report

**Export filtered CSV** uses the same period and matching rules as the report, across all matching pages. Changing filters or the selected period cancels a running export. Times in the page use Philippine time; exported timestamps use UTC. The export reads live data in batches, so records changed during export may affect later batches.

Dashboard, barcode, borrowing, inventory, statistics and path-finder screens do not have additional working data filters introduced by this attendance work.
