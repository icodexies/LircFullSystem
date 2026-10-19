-- Removes the records created while verifying the system stations: one test
-- loan recorded from SYS-B1 and one test visit pair recorded from SYS-A1.
-- The stations themselves stay; they are ready for real use.
-- ============================================================================
begin;

delete from public.library_fines
 where loan_id in (
   select id from public.book_loans
   where recorded_by = (select id from public."usersData" where library_id = 'SYS-B1'));

delete from public.book_loans
 where recorded_by = (select id from public."usersData" where library_id = 'SYS-B1');

delete from public.attendance
 where recorded_by = (select id from public."usersData" where library_id = 'SYS-A1');

notify pgrst, 'reload schema';
commit;
