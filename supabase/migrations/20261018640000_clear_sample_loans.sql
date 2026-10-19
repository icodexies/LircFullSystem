-- Clears the sample borrowing records (the imported demonstration loans) at
-- the owner's request. Nothing else is touched: attendance, members, catalog,
-- announcements and everything else stay as they are.
--
-- Safety: a private backup copy of the records stays inside the database as
-- `book_loans_sample_backup`. The app cannot read it (no grants); it exists
-- only so the records can be restored if they are ever needed again.
-- ============================================================================
begin;

-- 1) Private backup (one-time; skipped if it already exists).
create table if not exists public.book_loans_sample_backup
  as select * from public.book_loans;
alter table public.book_loans_sample_backup enable row level security;
revoke all privileges on table public.book_loans_sample_backup
  from public, anon, authenticated;
grant all privileges on table public.book_loans_sample_backup to service_role;

-- 2) Fines that pointed at these loans go with them (none expected).
delete from public.library_fines
 where loan_id in (select id from public.book_loans);

-- 3) Overdue reminder notifications belong to those loans.
delete from public.notifications where type = 'overdue';

-- 4) The records themselves. Open loans disappear with them, so every copy
--    returns to "available" in circulation.
delete from public.book_loans;
analyze public.book_loans;

notify pgrst, 'reload schema';
commit;
