-- Returns must come from the borrower themselves.
-- The return form now takes the library card; the database checks it against
-- the loan's borrower and rejects any other card with a clear message.
begin;

drop function if exists public.lirc_return_loan(bigint, timestamptz);

create or replace function public.lirc_return_loan(
  p_loan_id bigint,
  p_library_id text,
  p_returned_at timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operator bigint;
  l public.book_loans%ROWTYPE;
  v_card text;
  u public."usersData"%ROWTYPE;
  v_borrower text;
  v_returned timestamptz;
begin
  v_operator := lirc_private.library_operator_id();
  if v_operator is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;

  v_card := btrim(p_library_id);
  if v_card ~ '^\*.*\*$' and length(v_card) > 2 then
    v_card := substr(v_card, 2, length(v_card) - 2);
  end if;
  if v_card = '' or length(v_card) > 120 then
    raise exception 'Scan the borrower''s library card.';
  end if;

  select * into l from public.book_loans where id = p_loan_id for update;
  if not found then raise exception 'Loan not found.'; end if;
  if l.returned_at is not null then raise exception 'This loan is already returned.'; end if;

  select * into u from public."usersData" where library_id = v_card;
  if not found then raise exception 'Library card not found.'; end if;
  if u.id <> l.user_profile_id then
    select concat_ws(' ', b.first_name, b.middle_initial, b.surname)
      into v_borrower
      from public."usersData" b
     where b.id = l.user_profile_id;
    raise exception 'This copy was borrowed by %. Only the borrower''s card can return it.', v_borrower;
  end if;

  v_returned := coalesce(p_returned_at, now());
  if v_returned < l.borrowed_at then
    raise exception 'The return date/time cannot be before the start.';
  end if;
  if v_returned > now() + interval '1 day' then
    raise exception 'The return date/time cannot be in the future.';
  end if;

  update public.book_loans
     set returned_at = v_returned, returned_by = v_operator
   where id = p_loan_id;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.lirc_return_loan(bigint,text,timestamptz) from public, anon;
grant execute on function public.lirc_return_loan(bigint,text,timestamptz) to authenticated;

notify pgrst, 'reload schema';
commit;
