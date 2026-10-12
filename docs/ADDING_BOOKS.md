# Adding books

The **Adding Books** page (librarian / admin) creates a book record together
with its physical copies, in one save. The workflow:

## The Add Book window

1. **Add Book** opens the window. The first step is a highlighted "check
   first" box: **fill the ISBN first** when the book has one (scanning its
   barcode works), or search by title for books without an ISBN yet. Press
   Enter or **Search**.
2. Depending on the result:
   - **Exactly one ISBN match** — the record information **automatically
     fills the book form below**, its **saved copies load into the accession
     rows**, and the window switches to *"adding copies to an existing
     record"* (the fields lock; **Create a new book instead** keeps the
     values but unlocks them).
   - **Several matches** — pick one with **Use this record**; the same
     auto-fill, copy loading and lock happens for the chosen record.
   - **No match** — a "no existing record" note appears, and the typed
     ISBN/title is carried into the form so the new book can be completed
     directly.
3. **Book information** — title (required), author, ISBN, publisher,
   edition, publication year, call number. The form is locked while adding
   copies to an existing record.
4. **Accession numbers** — one row per physical copy. Each row has its own
   **shelf**. When a record is linked, its **saved copies appear as editable
   rows** — change them, remove them, or keep them as they are — and
   **+ Add another accession number** adds new copies. The **Apply to all
   rows** helper sets the same shelf everywhere.
5. **Total copies** updates live — a filled row counts as one copy; staff
   never type a quantity.
6. **Save** validates (see below). A new book is stored together with its
   accession records (`Book saved successfully with 3 accession numbers.`);
   a linked record reports its changes (`Book record updated — 2 updated,
   1 removed, 3 added.`). The list below refreshes. On any error, the window
   shows which field needs fixing and keeps everything typed. A copy that
   has loan records cannot be removed — the borrowing history must stay.

## Checks (client and database)

| Check | Where |
| --- | --- |
| Title required (≤ 500 chars), other fields length-limited, year 1000–2100 | form + `lirc_add_book` |
| At least one accession number; max 200 per save; ≤ 120 chars each | form + `lirc_private.clean_accessions` |
| No accession number repeated in the form (case-insensitive) | form + database |
| No accession number already in the catalog (case-insensitive) | database (the catalog list re-checks too) |
| Shelf must exist | database |
| Removing a copy that has loan records is refused (history stays) | database |
| Librarian / admin only | `lirc_private.can_edit_catalog()` |

## Notes

- Copies carry a **per-copy shelf** (`book_accession_numbers.shelf_id`; older
  rows keep NULL). A per-copy "condition" field was tried and removed again
  (migration `20261013100000_remove_copy_condition.sql`) because it was not
  part of the original schema.
- The catalog shows **one section per book**; when a new book is saved, its
  book-level section is set from the **first copy's shelf** (each copy keeps
  its own shelf; the OPAC edit form can still change the book section).
- Material format, barcode tag and asset number are not part of this form
  yet; the OPAC edit window can set them later.

## Files

| File | Job |
| --- | --- |
| Migration `20261012220000_add_book_workflow.sql` | Per-copy shelf column + `lirc_add_book`, `lirc_add_accessions` |
| Migration `20261013090000_edit_book_copies.sql` | `lirc_save_book_copies` — updates, removals and additions in one transaction |
| Migration `20261013100000_remove_copy_condition.sql` | Removes the trial condition field again |
| `src/services/catalog/newBookRules.js` | Pure form rules (new book, accessions, copy-save plan) |
| `src/services/catalog/bookService.js` | `findPossibleBooks`, `addBookWithCopies`, `getAccessionRowsForEdit`, `saveBookCopies` |
| `src/components/catalog/AddBookDialog.jsx` | The window (search first, form, editable copies) |
| `src/pages/PrivatePages/AddingBooks/AddingBooks.jsx` | The page: Add Book button + catalog list |

## Testing it

1. Adding Books → **Add Book** → scan/type the ISBN of an existing book →
   **Search** → the record fills the form below automatically (locked, in
   "adding copies" mode). Try a title with several matches → pick one with
   **Use this record**. Try an ISBN with no match → the note appears and the
   ISBN is carried into the new-book form.
2. Add two or three accession numbers (try a duplicate first — the window
   refuses it and keeps your input), pick a shelf, use **Apply to all rows**.
3. Use an existing record and edit its saved copies: change one shelf,
   remove a copy (a copy with loans is refused), add a new accession number
   → **Save changes** → the toast lists *updated / removed / added*.
4. Save a new book → toast *"Book saved successfully with 2 accession
   numbers."* → the list refreshes; the copies are visible in Book Borrow's
   *Copies & loans* window for that book.
5. Create a brand-new book the same way and check it appears in the OPAC.
