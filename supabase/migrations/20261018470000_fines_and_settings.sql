-- ============================================================================
-- Fines and charges + the settings store.
--
-- Settings: a small key/value table so admins can switch policies on and off.
-- The first setting is "fines": enabled (on/off), rate_per_day (₱5 by
-- default). Everything fine-related is gated by that switch, so the library
-- can run without charges and turn them on whenever it is ready.
--
-- Fines:
--   * overdue  — assessed automatically when a late loan is RETURNED
--                (days late × rate, a started day counts), one row per loan
--   * lost     — assessed when a librarian marks a copy LOST: the open loan
--                is closed and the borrower owes the replacement amount
--   * unpaid fines BLOCK new borrows (the borrow desk shows the balance);
--     staff settle them as "paid" or "waived"
--
-- All tables are RPC-only (no client policies), matching the other modules.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- Settings store
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_by bigint references public."usersData"(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
revoke all privileges on table public.app_settings from public, anon, authenticated;
grant all privileges on table public.app_settings to service_role;

insert into public.app_settings (key, value)
values ('fines', '{"enabled": false, "rate_per_day": 5, "currency": "PHP"}'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Fines ledger
-- ---------------------------------------------------------------------------
create table if not exists public.library_fines (
  id bigint generated always as identity primary key,
  user_profile_id bigint not null references public."usersData"(id) on delete restrict,
  loan_id bigint references public.book_loans(id) on delete set null,
  accession_id bigint references public.book_accession_numbers(id) on delete set null,
  kind text not null check (kind in ('overdue', 'lost')),
  days_late int,
  rate_per_day numeric(8, 2),
  amount numeric(10, 2) not null check (amount >= 0),
  reason text,
  status text not null default 'unpaid'
    check (status in ('unpaid', 'paid', 'waived')),
  assessed_by bigint references public."usersData"(id) on delete set null,
  assessed_at timestamptz not null default now(),
  settled_by bigint references public."usersData"(id) on delete set null,
  settled_at timestamptz,
  settle_note text
);

-- One overdue charge per loan (the trigger is idempotent).
create unique index if not exists library_fines_overdue_unique
  on public.library_fines (loan_id)
  where kind = 'overdue';
create index if not exists library_fines_member_idx
  on public.library_fines (user_profile_id, status, assessed_at desc);

alter table public.library_fines enable row level security;
revoke all privileges on table public.library_fines from public, anon, authenticated;
grant all privileges on table public.library_fines to service_role;

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------
-- The fines setting with safe defaults when it is missing.
create or replace function lirc_private.fines_setting()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select value from public.app_settings where key = 'fines'),
    '{"enabled": false, "rate_per_day": 5, "currency": "PHP"}'::jsonb);
$$;
revoke all on function lirc_private.fines_setting() from public, anon, authenticated;

-- Whole days late: a started day counts (due 5:00 PM, returned 5:01 PM = 1).
create or replace function lirc_private.days_late_between(p_due timestamptz, p_returned timestamptz)
returns int
language sql
immutable
as $$
  select greatest(1, ceil(extract(epoch from (p_returned - p_due)) / 86400.0)::int);
$$;
revoke all on function lirc_private.days_late_between(timestamptz, timestamptz) from public, anon, authenticated;

-- Assess the overdue fine when a late loan is returned (once per loan).
create or replace function lirc_private.assess_overdue_fine()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v jsonb := lirc_private.fines_setting();
  v_rate numeric;
  v_days int;
begin
  if new.returned_at is null or new.returned_at <= new.due_at then
    return new;
  end if;
  -- A lost copy already carries its own charge; never double-bill.
  if exists (select 1 from public.library_fines f where f.loan_id = new.id) then
    return new;
  end if;
  if coalesce((v ->> 'enabled')::boolean, false) is not true then
    return new;
  end if;
  v_rate := coalesce((v ->> 'rate_per_day')::numeric, 0);
  if v_rate <= 0 then
    return new;
  end if;
  v_days := lirc_private.days_late_between(new.due_at, new.returned_at);
  insert into public.library_fines
    (user_profile_id, loan_id, accession_id, kind, days_late, rate_per_day, amount, reason)
  values
    (new.user_profile_id, new.id, new.accession_id, 'overdue', v_days, v_rate,
     v_days * v_rate,
     format('%s day(s) overdue × ₱%s/day', v_days, to_char(v_rate, 'FM999999990.##')))
  on conflict (loan_id) where kind = 'overdue' do nothing;
  return new;
end;
$$;
revoke all on function lirc_private.assess_overdue_fine() from public, anon, authenticated;

drop trigger if exists lirc_assess_overdue_fine on public.book_loans;
create trigger lirc_assess_overdue_fine
  after update of returned_at on public.book_loans
  for each row
  when (new.returned_at is not null and old.returned_at is null)
  execute function lirc_private.assess_overdue_fine();

-- Unpaid fines block new borrows while the setting is on.
create or replace function lirc_private.block_borrow_with_fines()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v jsonb := lirc_private.fines_setting();
  v_due numeric;
begin
  if coalesce((v ->> 'enabled')::boolean, false) is not true then
    return new;
  end if;
  select coalesce(sum(amount), 0) into v_due
  from public.library_fines
  where user_profile_id = new.user_profile_id and status = 'unpaid';
  if v_due > 0 then
    raise exception 'This member has ₱% in unpaid fines. Settle them before lending again.',
      to_char(v_due, 'FM999999990.00');
  end if;
  return new;
end;
$$;
revoke all on function lirc_private.block_borrow_with_fines() from public, anon, authenticated;

drop trigger if exists lirc_block_borrow_with_fines on public.book_loans;
create trigger lirc_block_borrow_with_fines
  before insert on public.book_loans
  for each row
  execute function lirc_private.block_borrow_with_fines();

-- ---------------------------------------------------------------------------
-- RPC: read the settings (library operators)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_settings_get()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if lirc_private.library_operator_id() is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  return coalesce(
    (select jsonb_object_agg(key, value) from public.app_settings),
    '{}'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: admins switch the fines on/off and set the rate
-- ---------------------------------------------------------------------------
create or replace function public.lirc_settings_set_fines(
  p_enabled boolean, p_rate_per_day numeric)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_value jsonb;
begin
  if not lirc_private.is_admin() then
    raise exception 'Only admins can change the fines setting.' using errcode = '42501';
  end if;
  if p_rate_per_day is null or p_rate_per_day < 0 or p_rate_per_day > 1000 then
    raise exception 'The rate must be between ₱0 and ₱1,000 per day.';
  end if;
  v_value := jsonb_build_object(
    'enabled', coalesce(p_enabled, false),
    'rate_per_day', round(p_rate_per_day, 2),
    'currency', 'PHP');
  insert into public.app_settings (key, value, updated_by, updated_at)
  values ('fines', v_value, lirc_private.my_profile_id(), now())
  on conflict (key) do update
    set value = excluded.value,
        updated_by = excluded.updated_by,
        updated_at = now();
  return v_value;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: one member's fines (library operators) — settled rows, unpaid total,
-- and what is accruing right now on their open overdue loans
-- ---------------------------------------------------------------------------
create or replace function public.lirc_member_fines(p_profile_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb := lirc_private.fines_setting();
  v_rate numeric := coalesce((v ->> 'rate_per_day')::numeric, 0);
  v_enabled boolean := coalesce((v ->> 'enabled')::boolean, false);
begin
  if lirc_private.library_operator_id() is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'enabled', v_enabled,
    'rate_per_day', v_rate,
    'unpaid_total', coalesce((
      select sum(amount) from public.library_fines
      where user_profile_id = p_profile_id and status = 'unpaid'), 0),
    'unpaid_count', coalesce((
      select count(*) from public.library_fines
      where user_profile_id = p_profile_id and status = 'unpaid'), 0),
    'fines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id,
        'kind', f.kind,
        'days_late', f.days_late,
        'rate_per_day', f.rate_per_day,
        'amount', f.amount,
        'reason', f.reason,
        'status', f.status,
        'assessed_at', f.assessed_at,
        'settled_at', f.settled_at,
        'settle_note', f.settle_note,
        'book_name', b.book_name,
        'accession_number', a.accession_number,
        'settled_by_name', (
          select btrim(u.first_name || ' ' || u.surname)
          from public."usersData" u where u.id = f.settled_by))
        order by f.assessed_at desc)
      from (
        select * from public.library_fines
        where user_profile_id = p_profile_id
        order by assessed_at desc
        limit 50
      ) f
      left join public.books b on b.id = (
        select book_id from public.book_accession_numbers where id = f.accession_id)
      left join public.book_accession_numbers a on a.id = f.accession_id
    ), '[]'::jsonb),
    'accruing', case when v_enabled and v_rate > 0 then coalesce((
      select jsonb_agg(jsonb_build_object(
        'loan_id', l.id,
        'book_name', b.book_name,
        'accession_number', a.accession_number,
        'due_at', l.due_at,
        'days_overdue', lirc_private.days_late_between(l.due_at, now()),
        'amount', lirc_private.days_late_between(l.due_at, now()) * v_rate)
        order by l.due_at)
      from public.book_loans l
      join public.book_accession_numbers a on a.id = l.accession_id
      join public.books b on b.id = a.book_id
      where l.user_profile_id = p_profile_id
        and l.returned_at is null
        and l.due_at < now()
    ), '[]'::jsonb) else '[]'::jsonb end);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: the signed-in member's own fines (any member — dashboard card)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_my_fines()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb := lirc_private.fines_setting();
  v_me bigint := lirc_private.my_profile_id();
begin
  if v_me is null then
    return jsonb_build_object('enabled', false, 'unpaid_total', 0, 'unpaid_count', 0);
  end if;
  return jsonb_build_object(
    'enabled', coalesce((v ->> 'enabled')::boolean, false),
    'rate_per_day', coalesce((v ->> 'rate_per_day')::numeric, 0),
    'unpaid_total', coalesce((
      select sum(amount) from public.library_fines
      where user_profile_id = v_me and status = 'unpaid'), 0),
    'unpaid_count', coalesce((
      select count(*) from public.library_fines
      where user_profile_id = v_me and status = 'unpaid'), 0));
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: mark a copy lost — closes its open loan and charges the borrower
-- (the replacement amount is only charged while the fines setting is on)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_flag_copy_lost(
  p_accession_id bigint, p_amount numeric default 0, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operator bigint := lirc_private.library_operator_id();
  v jsonb := lirc_private.fines_setting();
  v_enabled boolean := coalesce((v ->> 'enabled')::boolean, false);
  v_amount numeric := coalesce(p_amount, 0);
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  a public.book_accession_numbers%ROWTYPE;
  l public.book_loans%ROWTYPE;
  v_has_loan boolean := false;
  v_fine_id bigint;
begin
  if v_operator is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  select * into a from public.book_accession_numbers
  where id = p_accession_id for update;
  if not found then
    raise exception 'Copy not found.';
  end if;
  if lower(btrim(a.status)) = 'lost' then
    raise exception 'This copy is already marked lost.';
  end if;
  if v_amount < 0 or v_amount > 100000 then
    raise exception 'The amount must be between ₱0 and ₱100,000.';
  end if;
  if v_note is not null and length(v_note) > 200 then
    raise exception 'Keep the note under 200 characters.';
  end if;

  select * into l from public.book_loans
  where accession_id = p_accession_id and returned_at is null
  for update;
  v_has_loan := found;

  -- Charge the borrower first, so the overdue trigger sees it and stays quiet.
  if v_has_loan and v_enabled then
    if v_amount <= 0 then
      raise exception 'Enter the replacement amount the borrower should pay.';
    end if;
    insert into public.library_fines
      (user_profile_id, loan_id, accession_id, kind, amount, reason, assessed_by)
    values
      (l.user_profile_id, l.id, a.id, 'lost', v_amount,
       coalesce(v_note, format('Lost copy %s — replacement cost', a.accession_number)),
       v_operator)
    returning id into v_fine_id;
  end if;

  update public.book_accession_numbers set status = 'Lost' where id = a.id;
  if v_has_loan then
    update public.book_loans
       set returned_at = now(), returned_by = v_operator
     where id = l.id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'fine_id', v_fine_id,
    'charged', v_fine_id is not null,
    'closed_loan', v_has_loan);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: settle a fine — paid or waived (library operators)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_fine_settle(
  p_fine_id bigint, p_action text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operator bigint := lirc_private.library_operator_id();
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  f public.library_fines%ROWTYPE;
begin
  if v_operator is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  if p_action not in ('paid', 'waived') then
    raise exception 'Choose paid or waived.';
  end if;
  if v_note is not null and length(v_note) > 200 then
    raise exception 'Keep the note under 200 characters.';
  end if;
  select * into f from public.library_fines where id = p_fine_id for update;
  if not found then
    raise exception 'Fine not found.';
  end if;
  if f.status <> 'unpaid' then
    raise exception 'This fine was already settled.';
  end if;
  update public.library_fines
     set status = p_action,
         settled_by = v_operator,
         settled_at = now(),
         settle_note = v_note
   where id = p_fine_id;
  return jsonb_build_object('ok', true, 'status', p_action);
end;
$$;

-- ---------------------------------------------------------------------------
-- Lost copies stop counting as available in Path Finder
-- ---------------------------------------------------------------------------
create or replace function lirc_private.path_finder_book_json(p_book_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'book_id', b.id,
    'book_name', b.book_name,
    'author', b.author,
    'isbn', b.isbn,
    'book_image', b.book_image,
    'call_number', b.call_number,
    'shelf', sh.name,
    'copies', (select count(*) from public.book_accession_numbers a where a.book_id = b.id),
    'available', (select count(*) from public.book_accession_numbers a
                  where a.book_id = b.id
                    and lower(btrim(a.status)) = 'available'
                    and not exists (select 1 from public.book_loans l
                                    where l.accession_id = a.id and l.returned_at is null))
  )
  from public.books b
  left join public.shelves sh on sh.id = b.shelf_id
  where b.id = p_book_id;
$$;
revoke all on function lirc_private.path_finder_book_json(bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function public.lirc_settings_get() from public, anon, authenticated;
revoke all on function public.lirc_settings_set_fines(boolean, numeric) from public, anon, authenticated;
revoke all on function public.lirc_member_fines(bigint) from public, anon, authenticated;
revoke all on function public.lirc_my_fines() from public, anon, authenticated;
revoke all on function public.lirc_flag_copy_lost(bigint, numeric, text) from public, anon, authenticated;
revoke all on function public.lirc_fine_settle(bigint, text, text) from public, anon, authenticated;

grant execute on function public.lirc_settings_get(),
  public.lirc_settings_set_fines(boolean, numeric),
  public.lirc_member_fines(bigint),
  public.lirc_my_fines(),
  public.lirc_flag_copy_lost(bigint, numeric, text),
  public.lirc_fine_settle(bigint, text, text)
  to authenticated;

commit;
