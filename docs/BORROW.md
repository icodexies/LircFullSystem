# Book borrowing

The **Book Borrow** page (staff / librarian / admin) records loans of exact
physical copies, tracks returns, and answers "who borrowed this book?".
Its tabs also list every **borrowed / overdue / returned** record with search
and filters. A member's own borrow and attendance history lives on the
[Users page](MEMBERS.md).

## The flow

1. **Find a book** — search like the OPAC (title, author, ISBN, call number
   or accession number). Searching by accession number jumps straight to the
   book that holds that copy.
2. **Open "Copies & loans"** — the window lists every copy by **accession
   number**: available copies, and on-loan copies with who has them and the
   due date (overdue marked). Below it sits the **borrowing history** — every
   person who borrowed the book, current and returned, newest first, six per
   page.
3. **Borrow a copy** — press *Borrow this copy*, then find the member: type a
   name and pick them from the list under the box, or scan the card. The name
   search accepts any word order ("Reyes Maria"), a middle initial first
   ("D. Villanueva"), and small typos ("Villanueba", even in two words). The
   list shows each match's card, role, active loans and overdue count. Review
   name, card, active/overdue loans, and (for students) whether their library
   validation is in order. Staff set the **start and due date+time** (default:
   now → +7 days). An *already returned* checkbox records old history in one
   step.
4. **Returns** — press *Return this copy* on an on-loan accession: scan the
   **borrower's own card**, set the return date+time, and record. The
   database checks the card against the loan record and rejects anyone who
   is not the borrower.

## The records tabs

The page's other tabs read `lirc_loan_records` — one page at a time with
server-side totals:

- **Borrowed** — every copy that is out right now, newest first; overdue
  ones are marked. **Overdue** — past due, most overdue first. **Returned**
  — completed loans, most recently returned first.
- **Filters** — *Person* (name with word-order-free close-spelling match, or
  a library card), *Role*, *Book* (title or accession number), and a date
  range that follows the list (borrowed dates for borrowed/overdue, returned
  dates for returned). The range starts empty so open loans never hide; the
  *This semester* button fills it from the header semester.
- **Tab badges** — the Borrowed and Overdue tabs show how many records match
  the current filters (with no filters: the whole library — "238 out,
  51 overdue"). The counts ignore the date range so open loans stay visible.
- **Copies & loans** on a row opens the book's window, so a return can happen
  straight from a record.
- **Borrower status** — a member's optional person status (active, on leave,
  retired, resigned, separated, deceased) shows as a badge under their name in
  these lists and in the Report tab; the Excel report carries it as a **Person
  status** column. Use it to tell why an overdue borrower can no longer be
  reached.

## Overdue reminders

Every day at **8:00 AM Philippine time** the system reminds borrowers whose
books are past due: a bell notification **on the due date** ("is due today"),
then one **each day while the book stays out** — up to **30 days past the due
date**, after which it stops. One reminder per loan per day, so nothing is
ever sent twice. The member needs a **login account** to see the bell; the
reminders are recorded either way.

## The rules (all enforced in the database)

| Rule | Detail |
| --- | --- |
| Operators | Only `staff`, `librarian` and `admin` profiles can borrow or return. |
| One copy, one holder | A copy is unavailable while it has an open (unreturned) loan. The `status` column is a display hint only. |
| Return by the borrower | A return is accepted only from the **borrower's own library card**, checked against the loan record. Any other card is rejected with a message naming the real borrower. |
| Student validation | When the loan **starts inside the current school year**, the student needs a validated enrollment (Enrolled status + system year level) — the same rule as entering the library. Historical records (start outside the current year) skip this so old data can be entered. |
| Dates | Due must be after the start; at most **366 days**; start may be past (old records) but not future; a return cannot be before the start or in the future. |
| Overdue warning | No borrowing limits. If the member has overdue books, the operator sees a **confirm/cancel warning** listing them before the loan is recorded. |
| Fees | None yet — see below. |

## Adding fees later (by design)

There are no fees in this version, but everything needed to add them is
already stored: every loan keeps `borrowed_at`, `due_at` and `returned_at`.
When the school decides on fines:

1. Add one row/column for the rate, for example a `fine_per_day` value in a
   small settings table.
2. In `lirc_return_loan` (the single place a return happens) compute
   `overdue days × rate` from the stored dates and save it on the loan row
   (add a `fine_amount` column) — or keep it computed-only for reports.
3. Optionally notify the member, using the existing notification helper
   `lirc_private.notify_profile(...)` — see [notifications](NOTIFICATIONS.md).

No existing data needs to change for this, so the fee feature is purely
additive.

## Files

| File | Job |
| --- | --- |
| Migration `20261012170000_book_loans.sql` | `book_loans` table + all RPCs |
| Migration `20261018340000_loan_records.sql` | `lirc_loan_records` (borrowed/overdue/returned lists, filters, counts) + tab-sort indexes |
| `src/services/borrow/loanRules.js` | Manila date helpers + shared date validation (mirrored by the DB) + day-count wording |
| `src/services/borrow/borrowService.js` | RPC calls for preview, borrow, return, book/member lists, member search, records |
| `src/pages/PrivatePages/BookBorrow/BookBorrow.jsx` | The page (tabs + catalog search + copies window) |
| `src/components/borrow/LoanRecordsPanel.jsx` | The borrowed / overdue / returned lists (filters, pages, badges) |
| `src/hooks/borrow/useLoanRecords.js` | Numbered-page loading for the records lists |
| `src/components/borrow/BookLoanDialog.jsx` | Copies + history window |
| `src/components/borrow/BorrowAction.jsx` | The borrow flow (member search, validation, dates, confirm) |
| `src/components/borrow/MemberSearchField.jsx` | Name-or-card box with live member suggestions under it |
| `src/components/borrow/ReturnAction.jsx` | The return flow (borrower's card + return date, checked against the record) |

## RPCs (all operator-guarded)

| RPC | Purpose |
| --- | --- |
| `lirc_borrow_preview(card)` | Member summary + student validation + overdue warning data |
| `lirc_borrow_book(accession, profile, start, due, returned?)` | Record the loan (validations above) |
| `lirc_return_loan(loan_id, card, returned_at?)` | Close a loan — only the borrower's card is accepted |
| `lirc_book_loans(book_id)` | Everyone who borrowed one book |
| `lirc_member_loans(profile_id)` | Every book one member borrowed |
| `lirc_member_lookup(search)` | Find members by name or card |
| `lirc_loan_records(scope, filters, page, page_size)` | One page of borrowed/overdue/returned records + totals + tab counts |

## Testing it

The database holds **12,000 sample loans** (migrations
`20261012190000_seed_book_loans.sql` and `20261012200000_seed_book_loans_bulk.sql`):
returned history spread over the past two years, ~190 loans still out with a
future due date, and ~30 overdue ones — spread across real books and member
profiles, all recorded by the admin profile. To remove **every** loan later,
run `supabase/manual/lirc_clear_book_loans_demo.sql` (it clears the whole
table — including any real loans recorded through the page — so check the
count first).

1. Book Borrow → search a title → **Copies & loans** → press *Borrow this
   copy* on an available accession.
2. Scan a student card (a validated one). Record with today's dates.
   The copy now shows *On loan — {name} · due …*.
3. In the Copies & loans window, press *Return this copy*, scan the
   borrower's card, and record; the accession flips back to Available.
   Scanning any other member's card is rejected with a message.
4. Try an unvalidated student with today's start → the loan is refused with
   the validation reason; change the start date to a past school year → the
   historical record is accepted.
5. Optional: with a member holding an overdue book, borrowing shows the
   confirm/cancel overdue warning first.
6. **Records tabs** — open *Borrowed* to see every copy that is out, switch
   to *Overdue* for the most overdue first, and *Returned* for the newest
   returns. Type a name in *Person* to follow one member across all three
   tabs (the badges become their counts), or scan a card. Press *Copies &
   loans* on a row to return the copy.
