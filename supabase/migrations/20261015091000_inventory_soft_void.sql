-- ============================================================================
-- Stage 1b: inventory soft-void (history preserving corrections)
--
-- Decision (2026-10-14): keep BOTH the event log and the rows.
--   * inventory_entries gains voided_at / voided_by / voided_reason.
--   * "Undo missing" VOIDS the row instead of deleting it.
--   * A re-scan of a missing copy VOIDS the missing row and writes a fresh
--     Found row (instead of overwriting the missing row in place).
--   * Counts, unscanned lists, review lists and state ignore voided rows.
--   * One live entry per (session_id, accession_id) via a partial unique
--     index; voided rows stay for history.
--
-- Function bodies below are copied from the verified live definitions
-- (20261013120000_inventory.sql, 20261013140000_inventory_pause.sql,
-- 20261013180000_smarter_searches.sql) with only the marked changes.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. Columns + live-row uniqueness
-- ---------------------------------------------------------------------------
alter table public.inventory_entries
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by bigint
    references public."usersData"(id) on delete restrict,
  add column if not exists voided_reason text;

drop index if exists public.inventory_entries_once;
create unique index inventory_entries_live_once
  on public.inventory_entries (session_id, accession_id)
  where voided_at is null;

create index if not exists inventory_entries_voided_idx
  on public.inventory_entries (session_id, voided_at)
  where voided_at is not null;

-- ---------------------------------------------------------------------------
-- 2. Copy condition follows the latest LIVE entry only
-- ---------------------------------------------------------------------------
create or replace function lirc_private.refresh_copy_condition(p_accession_id bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.book_accession_numbers a
     set condition = (
       select case when e.outcome = 'Missing' then 'Missing' else e.condition end
       from public.inventory_entries e
       where e.accession_id = p_accession_id
         and e.voided_at is null
       order by e.recorded_at desc, e.id desc
       limit 1)
   where a.id = p_accession_id;
$$;
revoke all on function lirc_private.refresh_copy_condition(bigint)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Counts ignore voided rows
-- ---------------------------------------------------------------------------
create or replace function lirc_private.inventory_counts(p_session_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_total bigint;
  v_found bigint;
  v_good bigint;
  v_damaged bigint;
  v_missing bigint;
  v_not_checked bigint;
  v_borrowed bigint;
begin
  select count(*) into v_total from public.book_accession_numbers;
  select count(*) filter (where e.outcome = 'Found'),
         count(*) filter (where e.outcome = 'Found' and e.condition = 'Good'),
         count(*) filter (where e.outcome = 'Found' and e.condition = 'Damaged'),
         count(*) filter (where e.outcome = 'Missing')
    into v_found, v_good, v_damaged, v_missing
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
    'missing', v_missing,
    'not_checked', v_not_checked,
    'borrowed', v_borrowed,
    'remaining', v_missing + v_not_checked + v_borrowed);
end $$;
revoke all on function lirc_private.inventory_counts(bigint)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Scan: re-scan of a missing copy voids it and writes a fresh Found row;
--    duplicate scans log an attempt with zero state change.
-- ---------------------------------------------------------------------------
create or replace function public.lirc_inventory_scan(
  p_session_id bigint,
  p_accession text,
  p_condition text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
  if v_condition not in ('Good', 'Damaged') then
    raise exception 'Choose Good Condition or Damaged first.';
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
      -- Duplicate attempt: recorded with zero state change and zero credit.
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
end $$;

-- ---------------------------------------------------------------------------
-- 5. Missing confirmations: undo VOIDS the row instead of deleting it;
--    a duplicate confirmation logs an attempt with zero state change.
-- ---------------------------------------------------------------------------
create or replace function public.lirc_inventory_set_missing(
  p_session_id bigint,
  p_accession_id bigint,
  p_missing boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operator bigint;
  v_status text;
  v_entry_id bigint;
  v_had_entry boolean;
  e public.inventory_entries%ROWTYPE;
begin
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
    raise exception 'This inventory is already finished. Start a new one to change copies.';
  end if;
  if not exists (select 1 from public.book_accession_numbers a where a.id = p_accession_id) then
    raise exception 'Copy not found.';
  end if;

  select * into e
  from public.inventory_entries x
  where x.session_id = p_session_id and x.accession_id = p_accession_id
    and x.voided_at is null;
  v_had_entry := found;  -- captured before any PERFORM resets FOUND

  if p_missing then
    perform lirc_private.activity_context(
      'inventory.missing.add', 'inventory_entries');
    if v_had_entry then
      if e.outcome = 'Missing' then
        perform lirc_private.record_activity(
          p_action => 'inventory.missing.duplicate',
          p_entity_type => 'inventory_entries',
          p_entity_id => e.id,
          p_source => 'app',
          p_meta => jsonb_build_object('accession_id', p_accession_id));
        return jsonb_build_object(
          'entry', lirc_private.inventory_entry_json(e.id),
          'counts', lirc_private.inventory_counts(p_session_id));
      end if;
      raise exception 'This copy is already scanned in this inventory.';
    end if;
    if exists (
      select 1 from public.book_loans l
      where l.accession_id = p_accession_id and l.returned_at is null
    ) then
      raise exception 'This copy is on loan. It cannot be marked missing.';
    end if;
    insert into public.inventory_entries
      (session_id, accession_id, outcome, condition, recorded_by)
    values
      (p_session_id, p_accession_id, 'Missing', null, v_operator)
    returning id into v_entry_id;
    perform lirc_private.refresh_copy_condition(p_accession_id);
    return jsonb_build_object(
      'entry', lirc_private.inventory_entry_json(v_entry_id),
      'counts', lirc_private.inventory_counts(p_session_id));
  end if;

  if not v_had_entry or e.outcome <> 'Missing' then
    raise exception 'This copy is not marked missing.';
  end if;
  perform lirc_private.activity_context(
    'inventory.missing.undo', 'inventory_entries');
  update public.inventory_entries
     set voided_at = now(),
         voided_by = v_operator,
         voided_reason = 'Missing mark undone'
   where id = e.id;
  perform lirc_private.refresh_copy_condition(p_accession_id);
  return jsonb_build_object(
    'removed', true,
    'voided', true,
    'counts', lirc_private.inventory_counts(p_session_id));
end $$;

-- ---------------------------------------------------------------------------
-- 6. Review list ignores voided rows
-- ---------------------------------------------------------------------------
create or replace function public.lirc_inventory_unscanned(
  p_session_id bigint,
  p_search text default '',
  p_limit integer default 100,
  p_offset integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text;
  v_limit integer;
  v_offset integer;
  v_total bigint;
  v_rows jsonb;
begin
  if lirc_private.library_operator_id() is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.inventory_sessions s where s.id = p_session_id) then
    raise exception 'Inventory not found.';
  end if;
  v_search := btrim(coalesce(p_search, ''));
  if char_length(v_search) > 120 then
    v_search := left(v_search, 120);
  end if;
  v_limit := least(greatest(coalesce(p_limit, 100), 1), 200);
  v_offset := greatest(coalesce(p_offset, 0), 0);

  select count(*) into v_total
  from public.book_accession_numbers a
  join public.books b on b.id = a.book_id
  where not exists (
      select 1 from public.inventory_entries e
      where e.session_id = p_session_id and e.accession_id = a.id
        and e.outcome = 'Found' and e.voided_at is null)
    and (v_search = ''
      or not exists (
        select 1 from unnest(regexp_split_to_array(lower(v_search), '\s+')) as w
        where w <> ''
          and a.accession_number not ilike '%' || w || '%'
          and b.book_name not ilike '%' || w || '%'));

  select coalesce(jsonb_agg(x.row order by x.ord), '[]'::jsonb)
    into v_rows
  from (
    select jsonb_build_object(
        'accession_id', a.id,
        'accession_number', a.accession_number,
        'book_name', b.book_name,
        'borrowed', (l.id is not null),
        'missing', (e.id is not null),
        'condition', a.condition) as row,
      row_number() over (order by lower(a.accession_number), a.id) as ord
    from public.book_accession_numbers a
    join public.books b on b.id = a.book_id
    left join public.book_loans l
      on l.accession_id = a.id and l.returned_at is null
    left join public.inventory_entries e
      on e.session_id = p_session_id and e.accession_id = a.id
      and e.outcome = 'Missing' and e.voided_at is null
    where not exists (
        select 1 from public.inventory_entries f
        where f.session_id = p_session_id and f.accession_id = a.id
          and f.outcome = 'Found' and f.voided_at is null)
      and (v_search = ''
        or not exists (
          select 1 from unnest(regexp_split_to_array(lower(v_search), '\s+')) as w
          where w <> ''
            and a.accession_number not ilike '%' || w || '%'
            and b.book_name not ilike '%' || w || '%'))
    order by lower(a.accession_number), a.id
    limit v_limit offset v_offset
  ) x;

  return jsonb_build_object(
    'rows', v_rows,
    'total', v_total,
    'has_next', (v_offset + v_limit) < v_total);
end $$;

-- ---------------------------------------------------------------------------
-- 7. Record lists (history detail) ignore voided rows
-- ---------------------------------------------------------------------------
create or replace function public.lirc_inventory_entries(
  p_session_id bigint,
  p_limit integer default 100,
  p_offset integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_offset integer;
  v_total bigint;
  v_rows jsonb;
begin
  if lirc_private.library_operator_id() is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.inventory_sessions s where s.id = p_session_id) then
    raise exception 'Inventory not found.';
  end if;
  v_limit := least(greatest(coalesce(p_limit, 100), 1), 200);
  v_offset := greatest(coalesce(p_offset, 0), 0);
  select count(*) into v_total
  from public.inventory_entries e
  where e.session_id = p_session_id
    and e.voided_at is null;
  select coalesce(jsonb_agg(
           lirc_private.inventory_entry_json(x.id)
           order by x.recorded_at desc, x.id desc), '[]'::jsonb)
    into v_rows
  from (
    select e.id, e.recorded_at
    from public.inventory_entries e
    where e.session_id = p_session_id
      and e.voided_at is null
    order by e.recorded_at desc, e.id desc
    limit v_limit offset v_offset
  ) x;
  return jsonb_build_object(
    'rows', v_rows,
    'total', v_total,
    'has_next', (v_offset + v_limit) < v_total);
end $$;

-- ---------------------------------------------------------------------------
-- 8. Open-inventory state: recent scans ignore voided rows
-- ---------------------------------------------------------------------------
create or replace function public.lirc_inventory_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_session_id bigint;
  v_recent jsonb := '[]'::jsonb;
begin
  if lirc_private.library_operator_id() is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  select s.id into v_session_id
  from public.inventory_sessions s
  where s.status = 'open'
  limit 1;
  if v_session_id is null then
    return jsonb_build_object(
      'session', null,
      'counts', null,
      'recent', '[]'::jsonb,
      'paused', lirc_private.inventory_paused_json());
  end if;
  select coalesce(jsonb_agg(
           lirc_private.inventory_entry_json(x.id)
           order by x.recorded_at desc, x.id desc), '[]'::jsonb)
    into v_recent
  from (
    select e.id, e.recorded_at
    from public.inventory_entries e
    where e.session_id = v_session_id and e.outcome = 'Found'
      and e.voided_at is null
    order by e.recorded_at desc, e.id desc
    limit 20
  ) x;
  return jsonb_build_object(
    'session', lirc_private.inventory_session_json(v_session_id),
    'counts', lirc_private.inventory_counts(v_session_id),
    'recent', v_recent,
    'paused', lirc_private.inventory_paused_json());
end $$;

notify pgrst, 'reload schema';
commit;
