-- ============================================================================
-- Stage 1d: backdating marker for returns
--
-- return_recorded_at = when the return was ENTERED into the system, as
-- opposed to returned_at (the business date, which may be backdated).
--   * lirc_borrow_book inserting an already-returned old record  → stamped
--     (INSERT with returned_at set).
--   * lirc_return_loan transitioning returned_at null → value     → stamped.
--   * Corrections that change an existing returned_at             → not stamped.
--   * Existing rows stay NULL = "recorded time unavailable" and must render
--     that way.
-- Implemented as a deterministic trigger so every write path is covered
-- without touching the RPC bodies.
-- ============================================================================
begin;

alter table public.book_loans
  add column if not exists return_recorded_at timestamptz;

comment on column public.book_loans.return_recorded_at is
  'When the return was entered into the system. NULL means the recorded time is unavailable (row predates this column).';

create or replace function lirc_private.stamp_return_recorded()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.returned_at is not null
     and new.return_recorded_at is null
     and (tg_op = 'INSERT' or old.returned_at is null) then
    new.return_recorded_at := now();
  end if;
  return new;
end $$;
revoke all on function lirc_private.stamp_return_recorded()
  from public, anon, authenticated;

drop trigger if exists stamp_return_recorded on public.book_loans;
create trigger stamp_return_recorded
  before insert or update on public.book_loans
  for each row execute function lirc_private.stamp_return_recorded();

notify pgrst, 'reload schema';
commit;
