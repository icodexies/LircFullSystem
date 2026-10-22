-- Partial index for the active-loan count used by member search and the
-- borrower cards: every lookup filters user_profile_id and returned_at IS NULL.
begin;
create index if not exists loans_open_profile_idx
  on public.book_loans (user_profile_id)
  where returned_at is null;
commit;
