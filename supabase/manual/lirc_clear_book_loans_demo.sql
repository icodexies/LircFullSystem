-- CLEANUP: removes every row in public.book_loans.
--
-- Use this when the demo/sample loans (and any test loans) are no longer
-- needed. It clears the WHOLE table, so check what is inside first:
--   select count(*) from public.book_loans;
-- and note that any real loans recorded through the Book Borrow page are
-- removed too. Run in the SQL editor, or as a migration when you prefer.

delete from public.book_loans;
