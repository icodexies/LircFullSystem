-- ============================================================================
-- Inventory: the "Lost" condition, and the circulation archive.
--
-- The inventory can now save a copy as Lost (next to Good / Damaged). The
-- copy's STATUS follows its latest live scan:
--   Good    -> Available   (the only copies circulation shows)
--   Damaged -> Damaged  }  archived: hidden from the copies windows and the
--   Missing -> Missing  }  OPAC copy lists, never borrowable
--   Lost    -> Lost     }
-- Marking a copy lost from the fines flow (Copies & loans) also sets the
-- condition, so both paths agree. Everything that checks "Available" — the
-- borrow picker, the OPAC, Path Finder availability and the statistics —
-- follows along automatically.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. Allowed values
-- ---------------------------------------------------------------------------
alter table public.book_accession_numbers
  drop constraint if exists book_accession_condition_check;
alter table public.book_accession_numbers
  add constraint book_accession_condition_check
  check (condition is null or condition in ('Good', 'Damaged', 'Missing', 'Lost'));

alter table public.inventory_entries
  drop constraint if exists inventory_entries_condition_check;
alter table public.inventory_entries
  add constraint inventory_entries_condition_check
  check ((outcome = 'Found' and condition in ('Good', 'Damaged', 'Lost'))
      or (outcome = 'Missing' and condition is null));

-- "Missing" joins the status list so a not-found copy stops counting as
-- available.
alter table public.book_accession_numbers
  drop constraint if exists book_accession_numbers_status_check;
alter table public.book_accession_numbers
  add constraint book_accession_numbers_status_check
  check (status = any (array['Available', 'Borrowed', 'Reserved', 'Lost', 'Damaged', 'Missing', 'Withdrawn']));

-- ---------------------------------------------------------------------------
-- 2. The copy's condition (latest live scan) now also drives its status.
-- ---------------------------------------------------------------------------
create or replace function lirc_private.refresh_copy_condition(p_accession_id bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.book_accession_numbers a
     set condition = d.cond,
         status = case d.cond
                    when 'Lost' then 'Lost'
                    when 'Missing' then 'Missing'
                    when 'Damaged' then 'Damaged'
                    else 'Available'
                  end
  from (
    select case when e.outcome = 'Missing' then 'Missing' else e.condition end as cond
    from public.inventory_entries e
    where e.accession_id = p_accession_id
      and e.voided_at is null
    order by e.recorded_at desc, e.id desc
    limit 1
  ) d
  where a.id = p_accession_id;
$$;
revoke all on function lirc_private.refresh_copy_condition(bigint)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. The scan RPCs accept Lost
-- ---------------------------------------------------------------------------
create or replace function public.lirc_inventory_scan(p_session_id bigint, p_accession text, p_condition text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_operator bigint;
  v_accession text;
  v_condition text;
  v_status text;
  v_accession_id bigint;
  v_entry_id bigint;
  v_existing public.inventory_entries%ROWTYPE;
  v_replaced boolean := false;
begin
  perform lirc_private.activity_context('inventory.scan', 'inventory_entries');
  v_operator := lirc_private.library_operator_id();
  if v_operator is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;

  select s.status into v_status
  from public.inventory_sessions s
  where s.id = p_session_id
  for update;
  if not found then
    raise exception 'Inventory not found.';
  end if;
  if v_status = 'paused' then
    raise exception 'This inventory is paused. Resume it first.';
  end if;
  if v_status <> 'open' then
    raise exception 'This inventory was already finished. Open the history to review it, or start a new inventory.';
  end if;

  v_accession := btrim(coalesce(p_accession, ''));
  if v_accession ~ '^\*.*\*$' and char_length(v_accession) > 2 then
    v_accession := substr(v_accession, 2, char_length(v_accession) - 2);
  end if;
  if v_accession = '' or char_length(v_accession) > 120 then
    raise exception 'Scan or type an accession number.';
  end if;

  v_condition := btrim(coalesce(p_condition, ''));
  if v_condition not in ('Good', 'Damaged', 'Lost') then
    raise exception 'Choose Good Condition, Damaged or Lost first.';
  end if;

  select a.id into v_accession_id
  from public.book_accession_numbers a
  where lower(a.accession_number) = lower(v_accession)
  order by a.id
  limit 1;
  if v_accession_id is null then
    return jsonb_build_object('result', 'not_found');
  end if;

  select * into v_existing
  from public.inventory_entries e
  where e.session_id = p_session_id and e.accession_id = v_accession_id
    and e.voided_at is null;

  if found then
    if v_existing.outcome = 'Found' then
      -- Duplicate attempt: recorded with zero state change.
      perform lirc_private.record_activity(
        p_action => 'inventory.scan.duplicate',
        p_entity_type => 'inventory_entries',
        p_entity_id => v_existing.id,
        p_source => 'app',
        p_meta => jsonb_build_object('accession_number', v_accession));
      return jsonb_build_object(
        'result', 'already',
        'entry', lirc_private.inventory_entry_json(v_existing.id));
    end if;
    -- The copy was marked missing earlier; finding it voids that record and
    -- writes a fresh Found row. History keeps both rows.
    update public.inventory_entries
       set voided_at = now(),
           voided_by = v_operator,
           voided_reason = 'Found again on re-scan'
     where id = v_existing.id;
    insert into public.inventory_entries
      (session_id, accession_id, outcome, condition, recorded_by)
    values
      (p_session_id, v_accession_id, 'Found', v_condition, v_operator)
    returning id into v_entry_id;
    v_replaced := true;
  else
    insert into public.inventory_entries
      (session_id, accession_id, outcome, condition, recorded_by)
    values
      (p_session_id, v_accession_id, 'Found', v_condition, v_operator)
    returning id into v_entry_id;
  end if;

  perform lirc_private.refresh_copy_condition(v_accession_id);

  return jsonb_build_object(
    'result', 'saved',
    'replaced_missing', v_replaced,
    'entry', lirc_private.inventory_entry_json(v_entry_id),
    'counts', lirc_private.inventory_counts(p_session_id));
exception when unique_violation then
  -- Another station saved this copy first: behave like "already scanned".
  select e.id into v_entry_id
  from public.inventory_entries e
  where e.session_id = p_session_id and e.accession_id = v_accession_id
    and e.voided_at is null;
  if v_entry_id is not null then
    perform lirc_private.record_activity(
      p_action => 'inventory.scan.duplicate',
      p_entity_type => 'inventory_entries',
      p_entity_id => v_entry_id,
      p_source => 'app',
      p_meta => jsonb_build_object('accession_number', v_accession));
  end if;
  return jsonb_build_object(
    'result', 'already',
    'entry', lirc_private.inventory_entry_json(v_entry_id));
end $function$;

create or replace function public.lirc_inventory_update_entry(p_entry_id bigint, p_condition text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_operator bigint;
  v_condition text;
  v_status text;
  e public.inventory_entries%ROWTYPE;
begin
  perform lirc_private.activity_context('inventory.entry.update', 'inventory_entries');
  v_operator := lirc_private.library_operator_id();
  if v_operator is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  v_condition := btrim(coalesce(p_condition, ''));
  if v_condition not in ('Good', 'Damaged', 'Lost') then
    raise exception 'Choose Good Condition, Damaged or Lost.';
  end if;
  select * into e from public.inventory_entries where id = p_entry_id;
  if not found then
    raise exception 'Scan record not found.';
  end if;
  select s.status into v_status
  from public.inventory_sessions s
  where s.id = e.session_id
  for update;
  if v_status = 'paused' then
    raise exception 'This inventory is paused. Resume it first.';
  end if;
  if v_status <> 'open' then
    raise exception 'This inventory is already finished. Its records cannot be changed.';
  end if;
  if e.outcome <> 'Found' then
    raise exception 'Only scanned copies can be edited here.';
  end if;
  update public.inventory_entries
     set condition = v_condition
   where id = p_entry_id;
  perform lirc_private.refresh_copy_condition(e.accession_id);
  return jsonb_build_object(
    'entry', lirc_private.inventory_entry_json(p_entry_id),
    'counts', lirc_private.inventory_counts(e.session_id));
end $function$;

-- ---------------------------------------------------------------------------
-- 4. The counts gain the lost bucket
-- ---------------------------------------------------------------------------
create or replace function lirc_private.inventory_counts(p_session_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_total bigint;
  v_found bigint;
  v_good bigint;
  v_damaged bigint;
  v_lost bigint;
  v_missing bigint;
  v_not_checked bigint;
  v_borrowed bigint;
begin
  select count(*) into v_total from public.book_accession_numbers;
  select count(*) filter (where e.outcome = 'Found'),
         count(*) filter (where e.outcome = 'Found' and e.condition = 'Good'),
         count(*) filter (where e.outcome = 'Found' and e.condition = 'Damaged'),
         count(*) filter (where e.outcome = 'Found' and e.condition = 'Lost'),
         count(*) filter (where e.outcome = 'Missing')
    into v_found, v_good, v_damaged, v_lost, v_missing
  from public.inventory_entries e
  where e.session_id = p_session_id
    and e.voided_at is null;
  select count(*) filter (where l.id is null),
         count(*) filter (where l.id is not null)
    into v_not_checked, v_borrowed
  from public.book_accession_numbers a
  left join public.book_loans l
    on l.accession_id = a.id and l.returned_at is null
  where not exists (
    select 1 from public.inventory_entries e
    where e.session_id = p_session_id and e.accession_id = a.id
      and e.voided_at is null);
  return jsonb_build_object(
    'total', v_total,
    'found', v_found,
    'found_good', v_good,
    'found_damaged', v_damaged,
    'found_lost', v_lost,
    'missing', v_missing,
    'not_checked', v_not_checked,
    'borrowed', v_borrowed,
    'remaining', v_missing + v_not_checked + v_borrowed);
end $function$;

-- ---------------------------------------------------------------------------
-- 5. Lost from the fines flow sets the condition too (both paths agree)
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

  update public.book_accession_numbers
     set status = 'Lost', condition = 'Lost'
   where id = a.id;
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
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function public.lirc_inventory_scan(bigint, text, text) from public, anon, authenticated;
revoke all on function public.lirc_inventory_update_entry(bigint, text) from public, anon, authenticated;
revoke all on function public.lirc_flag_copy_lost(bigint, numeric, text) from public, anon, authenticated;
grant execute on function public.lirc_inventory_scan(bigint, text, text),
  public.lirc_inventory_update_entry(bigint, text),
  public.lirc_flag_copy_lost(bigint, numeric, text)
  to authenticated;

commit;
