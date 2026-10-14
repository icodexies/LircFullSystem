-- Pause and resume: an inventory can be set aside without finishing it.
--
-- Rules:
--   * status is now 'open' (the one being worked on), 'paused' (set aside)
--     or 'finished'. Only one inventory is open at a time; any number can be
--     paused.
--   * Pausing keeps every record; resuming makes it the open one again.
--   * Scanning, editing and missing confirmations only work while the
--     inventory is open.
begin;

alter table public.inventory_sessions
  add column if not exists paused_by bigint references public."usersData"(id) on delete restrict,
  add column if not exists paused_at timestamptz;

alter table public.inventory_sessions drop constraint if exists inventory_sessions_status_check;
alter table public.inventory_sessions
  add constraint inventory_sessions_status_check
  check (status in ('open', 'paused', 'finished'));

alter table public.inventory_sessions drop constraint if exists inventory_sessions_finished_check;
alter table public.inventory_sessions
  add constraint inventory_sessions_finished_check
  check (status <> 'finished' or finished_at is not null);

-- ---------------------------------------------------------------------------
-- Internal helpers (updated for the paused fields)
-- ---------------------------------------------------------------------------
create or replace function lirc_private.inventory_session_json(p_session_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id,
    'name', s.name,
    'year', s.year,
    'status', s.status,
    'summary', s.summary,
    'created_at', s.created_at,
    'created_by', concat_ws(' ', u.first_name, u.middle_initial, u.surname, u.suffix),
    'finished_at', s.finished_at,
    'finished_by', concat_ws(' ', f.first_name, f.middle_initial, f.surname, f.suffix),
    'paused_at', s.paused_at,
    'paused_by', concat_ws(' ', pb.first_name, pb.middle_initial, pb.surname, pb.suffix))
  from public.inventory_sessions s
  join public."usersData" u on u.id = s.created_by
  left join public."usersData" f on f.id = s.finished_by
  left join public."usersData" pb on pb.id = s.paused_by
  where s.id = p_session_id;
$$;
revoke all on function lirc_private.inventory_session_json(bigint)
  from public, anon, authenticated;

create or replace function lirc_private.inventory_paused_json()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'session', lirc_private.inventory_session_json(p.id),
           'counts', lirc_private.inventory_counts(p.id))
           order by p.paused_at desc nulls last, p.id desc), '[]'::jsonb)
  from public.inventory_sessions p
  where p.status = 'paused';
$$;
revoke all on function lirc_private.inventory_paused_json()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: the open inventory (or none), the paused ones, counts and recent scans
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
    order by e.recorded_at desc, e.id desc
    limit 20
  ) x;
  return jsonb_build_object(
    'session', lirc_private.inventory_session_json(v_session_id),
    'counts', lirc_private.inventory_counts(v_session_id),
    'recent', v_recent,
    'paused', lirc_private.inventory_paused_json());
end $$;

-- ---------------------------------------------------------------------------
-- RPC: start a new inventory (the open one must be paused or finished first)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_inventory_start(p_name text, p_year integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operator bigint;
  v_name text;
  v_session_id bigint;
begin
  v_operator := lirc_private.library_operator_id();
  if v_operator is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  v_name := btrim(coalesce(p_name, ''));
  if v_name = '' then
    raise exception 'Give the inventory a name.';
  end if;
  if char_length(v_name) > 200 then
    raise exception 'Inventory name must be 200 characters or fewer.';
  end if;
  if p_year is null or p_year < 1900 or p_year > 2100 then
    raise exception 'Enter a year between 1900 and 2100.';
  end if;
  if exists (select 1 from public.inventory_sessions s where s.status = 'open') then
    raise exception 'An inventory is already open. Pause it first or finish it.';
  end if;
  insert into public.inventory_sessions (name, year, created_by)
  values (v_name, p_year, v_operator)
  returning id into v_session_id;
  return jsonb_build_object(
    'session', lirc_private.inventory_session_json(v_session_id),
    'counts', lirc_private.inventory_counts(v_session_id),
    'recent', '[]'::jsonb,
    'paused', lirc_private.inventory_paused_json());
exception when unique_violation then
  raise exception 'An inventory is already open. Pause it first or finish it.';
end $$;

-- ---------------------------------------------------------------------------
-- RPC: pause the open inventory (keeps every record)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_inventory_pause(p_session_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operator bigint;
  v_status text;
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
  if v_status = 'finished' then
    raise exception 'This inventory is already finished.';
  end if;
  if v_status = 'open' then
    update public.inventory_sessions
       set status = 'paused', paused_by = v_operator, paused_at = now()
     where id = p_session_id;
  end if;
  return jsonb_build_object(
    'session', lirc_private.inventory_session_json(p_session_id));
end $$;

-- ---------------------------------------------------------------------------
-- RPC: resume a paused inventory (it becomes the open one again)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_inventory_resume(p_session_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operator bigint;
  v_status text;
  v_open_id bigint;
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
  if v_status = 'finished' then
    raise exception 'This inventory is already finished.';
  end if;
  if v_status = 'paused' then
    select s.id into v_open_id
    from public.inventory_sessions s
    where s.status = 'open' and s.id <> p_session_id
    limit 1;
    if v_open_id is not null then
      raise exception 'Another inventory is open. Pause it first.';
    end if;
    update public.inventory_sessions
       set status = 'open', paused_by = null, paused_at = null
     where id = p_session_id;
  end if;
  return jsonb_build_object(
    'session', lirc_private.inventory_session_json(p_session_id),
    'counts', lirc_private.inventory_counts(p_session_id));
exception when unique_violation then
  raise exception 'Another inventory is open. Pause it first.';
end $$;

-- ---------------------------------------------------------------------------
-- RPC: scan one accession number (saves immediately)
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
  where e.session_id = p_session_id and e.accession_id = v_accession_id;

  if found then
    if v_existing.outcome = 'Found' then
      return jsonb_build_object(
        'result', 'already',
        'entry', lirc_private.inventory_entry_json(v_existing.id));
    end if;
    -- The copy was marked missing earlier; finding it replaces that record.
    update public.inventory_entries
       set outcome = 'Found', condition = v_condition,
           recorded_by = v_operator, recorded_at = now()
     where id = v_existing.id
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
  where e.session_id = p_session_id and e.accession_id = v_accession_id;
  return jsonb_build_object(
    'result', 'already',
    'entry', lirc_private.inventory_entry_json(v_entry_id));
end $$;

-- ---------------------------------------------------------------------------
-- RPC: correct the condition of one saved scan
-- ---------------------------------------------------------------------------
create or replace function public.lirc_inventory_update_entry(
  p_entry_id bigint,
  p_condition text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operator bigint;
  v_condition text;
  v_status text;
  e public.inventory_entries%ROWTYPE;
begin
  v_operator := lirc_private.library_operator_id();
  if v_operator is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  v_condition := btrim(coalesce(p_condition, ''));
  if v_condition not in ('Good', 'Damaged') then
    raise exception 'Choose Good Condition or Damaged.';
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
end $$;

-- ---------------------------------------------------------------------------
-- RPC: confirm a copy as missing (or undo that)
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
  where x.session_id = p_session_id and x.accession_id = p_accession_id;

  if p_missing then
    if found then
      if e.outcome = 'Missing' then
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

  if not found or e.outcome <> 'Missing' then
    raise exception 'This copy is not marked missing.';
  end if;
  delete from public.inventory_entries where id = e.id;
  perform lirc_private.refresh_copy_condition(p_accession_id);
  return jsonb_build_object(
    'removed', true,
    'counts', lirc_private.inventory_counts(p_session_id));
end $$;

-- ---------------------------------------------------------------------------
-- RPC: finish an inventory (locks records, stores the summary)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_inventory_finish(p_session_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operator bigint;
  v_status text;
  v_summary jsonb;
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
    raise exception 'This inventory is paused. Resume it first, then finish it.';
  end if;
  if v_status <> 'open' then
    raise exception 'This inventory is already finished.';
  end if;
  v_summary := lirc_private.inventory_counts(p_session_id);
  update public.inventory_sessions
     set status = 'finished',
         finished_by = v_operator,
         finished_at = now(),
         summary = v_summary
   where id = p_session_id;
  return jsonb_build_object(
    'session', lirc_private.inventory_session_json(p_session_id),
    'summary', v_summary);
end $$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function
  public.lirc_inventory_pause(bigint),
  public.lirc_inventory_resume(bigint)
  from public, anon;
grant execute on function
  public.lirc_inventory_pause(bigint),
  public.lirc_inventory_resume(bigint)
  to authenticated;

notify pgrst, 'reload schema';
commit;
