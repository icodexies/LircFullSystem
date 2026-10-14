# Book borrowing

The **Book Borrow** page (staff / librarian / admin) records loans of exact
physical copies, tracks returns, and answers "who borrowed this book?".
A member's own borrow and attendance history lives on the
[Users page](MEMBERS.md).

## The flow

1. **Find a book** — search like the OPAC (title, author, ISBN, call number
   or accession number). Searching by accession number jumps straight to the
   book that holds that copy.
2. **Open "Copies & loans"** — the window lists every copy by **accession
   number**: available copies, and on-loan copies with who has them and the
   due date (overdue marked). Below it sits the **borrowing history** — every
   person who borrowed the book, current and returned.
3. **Borrow a copy** — press *Borrow this copy*, scan the member's card, and
   review: name, card, active/overdue loans, and (for students) whether their
   library validation is in order. Staff set the **start and due date+time**
   (default: now → +7 days). An *already returned* checkbox records old
   history in one step.
4. **Returns** — press *Return this copy* on an on-loan accession: scan the
   **borrower's own card**, set the return date+time, and record. The
   database checks the card against the loan record and rejects anyone who
   is not the borrower.

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
| `src/services/borrow/loanRules.js` | Manila date helpers + shared date validation (mirrored by the DB) |
| `src/services/borrow/borrowService.js` | RPC calls for preview, borrow, return, book/member lists, member search |
| `src/pages/PrivatePages/BookBorrow/BookBorrow.jsx` | The page (catalog search + copies window) |
| `src/components/borrow/BookLoanDialog.jsx` | Copies + history window |
| `src/components/borrow/BorrowAction.jsx` | The borrow flow (card, validation, dates, confirm) |
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
