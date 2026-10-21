-- ============================================================================
-- Loan row actions: Edit dates and Return, straight from the Borrowed /
-- Overdue / Returned lists in Book Borrow.
--
-- Both RPCs are for library operators only — the same staff / librarian /
-- admin group used everywhere at the circulation desk (lirc_private.
-- library_operator_id). The return path is the same one the desk scanner uses:
-- return_recorded_at is stamped by the existing trigger and an overdue fine is
-- assessed by lirc_assess_overdue_fine when returned_at is set.
--
-- Edit changes the record's business dates only (start, due, and the return
-- date of an already-returned loan). An open loan is closed with Return, not
-- with Edit. Changing a return date does not recalculate a fine that was
-- already assessed.
-- ============================================================================
begin;

create or replace function public.lirc_edit_loan(
  p_loan_id bigint,
  p_borrowed_at timestamptz,
  p_due_at timestamptz,
  p_returned_at timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operator bigint;
  l public.book_loans%ROWTYPE;
  v_returned timestamptz;
begin
  v_operator := lirc_private.library_operator_id();
  if v_operator is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  if p_borrowed_at is null or p_due_at is null then
    raise exception 'Provide the start and due date/time.';
  end if;
  select * into l from public.book_loans where id = p_loan_id for update;
  if not found then raise exception 'Loan not found.'; end if;

  if p_borrowed_at < timestamptz '2015-01-01 00:00:00+08' then
    raise exception 'The start date/time looks invalid.';
  end if;
  if p_borrowed_at > now() + interval '1 day' then
    raise exception 'The start date/time cannot be in the future.';
  end if;
  if p_due_at <= p_borrowed_at then
    raise exception 'The due date/time must be after the start date/time.';
  end if;
  if p_due_at - p_borrowed_at > interval '366 days' then
    raise exception 'A loan longer than one year looks like a mistake. Check the dates.';
  end if;

  if l.returned_at is null then
    if p_returned_at is not null then
      raise exception 'Use Return to close an open loan.';
    end if;
    v_returned := null;
  else
    v_returned := coalesce(p_returned_at, l.returned_at);
    if v_returned < p_borrowed_at then
      raise exception 'The return date/time cannot be before the start.';
    end if;
    if v_returned > now() + interval '1 day' then
      raise exception 'The return date/time cannot be in the future.';
    end if;
  end if;

  update public.book_loans
     set borrowed_at = p_borrowed_at,
         due_at = p_due_at,
         returned_at = v_returned
   where id = p_loan_id;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.lirc_edit_loan(bigint,timestamptz,timestamptz,timestamptz)
  from public, anon, authenticated;
grant execute on function public.lirc_edit_loan(bigint,timestamptz,timestamptz,timestamptz)
  to authenticated;

create or replace function public.lirc_operator_return_loan(
  p_loan_id bigint,
  p_returned_at timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operator bigint;
  l public.book_loans%ROWTYPE;
  v_returned timestamptz;
begin
  v_operator := lirc_private.library_operator_id();
  if v_operator is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  select * into l from public.book_loans where id = p_loan_id for update;
  if not found then raise exception 'Loan not found.'; end if;
  if l.returned_at is not null then
    raise exception 'This loan is already returned.';
  end if;

  v_returned := coalesce(p_returned_at, now());
  if v_returned < l.borrowed_at then
    raise exception 'The return date/time cannot be before it was borrowed.';
  end if;
  if v_returned > now() + interval '1 day' then
    raise exception 'The return date/time cannot be in the future.';
  end if;

  update public.book_loans
     set returned_at = v_returned,
         returned_by = v_operator
   where id = p_loan_id;
  return jsonb_build_object('ok', true, 'returned_at', v_returned);
end $$;

revoke all on function public.lirc_operator_return_loan(bigint,timestamptz)
  from public, anon, authenticated;
grant execute on function public.lirc_operator_return_loan(bigint,timestamptz)
  to authenticated;

commit;
