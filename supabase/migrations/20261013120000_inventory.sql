-- Inventory scanning: count the library's physical copies shelf by shelf.
--
-- Rules (mirrored by the Inventory page and validated here):
--   * Staff, librarian or admin only (library operators).
--   * One open inventory at a time. An open inventory can be continued
--     anytime until it is finished.
--   * Scanning saves immediately. The record keeps the copy, the outcome
--     "Found", the condition chosen at the scanner, the staff member and the
--     date/time. The copy's current condition is updated to match.
--   * Scanning the same copy again in the same inventory reports
--     "already scanned" and never changes the saved record.
--   * Copies with no "Found" record stay "Not yet checked"; copies on loan
--     show as "Borrowed". Staff may confirm copies as "Missing" (and undo
--     it) until the inventory is finished.
--   * Finishing locks the records, stores a summary snapshot and keeps the
--     history; every copy keeps its latest confirmed condition.
begin;

-- The copy's current condition: Good / Damaged / Missing. NULL means the
-- copy has not been checked yet (or was never inventoried).
alter table public.book_accession_numbers add column if not exists condition text;
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.book_accession_numbers'::regclass
      and conname = 'book_accession_condition_check'
  ) then
    alter table public.book_accession_numbers
      add constraint book_accession_condition_check
      check (condition is null or condition in ('Good', 'Damaged', 'Missing'));
  end if;
end $$;

create table if not exists public.inventory_sessions (
  id bigint generated always as identity primary key,
  name text not null,
  year integer not null,
  status text not null default 'open',
  summary jsonb,
  created_by bigint not null references public."usersData"(id) on delete restrict,
  created_at timestamptz not null default now(),
  finished_by bigint references public."usersData"(id) on delete restrict,
  finished_at timestamptz,
  constraint inventory_sessions_status_check check (status in ('open', 'finished')),
  constraint inventory_sessions_finished_check check (status = 'open' or finished_at is not null),
  constraint inventory_sessions_year_check check (year between 1900 and 2100),
  constraint inventory_sessions_name_check check (char_length(btrim(name)) between 1 and 200)
);
create unique index if not exists inventory_sessions_one_open
  on public.inventory_sessions (status) where status = 'open';

create table if not exists public.inventory_entries (
  id bigint generated always as identity primary key,
  session_id bigint not null references public.inventory_sessions(id) on delete restrict,
  accession_id bigint not null references public.book_accession_numbers(id) on delete restrict,
  outcome text not null,
  condition text,
  recorded_by bigint not null references public."usersData"(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  constraint inventory_entries_outcome_check check (outcome in ('Found', 'Missing')),
  constraint inventory_entries_condition_check check (
    (outcome = 'Found' and condition in ('Good', 'Damaged'))
    or (outcome = 'Missing' and condition is null))
);
create unique index if not exists inventory_entries_once
  on public.inventory_entries (session_id, accession_id);
create index if not exists inventory_entries_session_idx
  on public.inventory_entries (session_id, recorded_at desc, id desc);
create index if not exists inventory_entries_accession_idx
  on public.inventory_entries (accession_id, recorded_at desc, id desc);

alter table public.inventory_sessions enable row level security;
alter table public.inventory_entries enable row level security;
revoke all privileges on table public.inventory_sessions, public.inventory_entries
  from public, anon, authenticated;
grant all privileges on table public.inventory_sessions, public.inventory_entries
  to service_role;
-- No client policies: only the RPCs below read or write these tables.

-- ---------------------------------------------------------------------------
-- Internal helpers
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
    'finished_by', concat_ws(' ', f.first_name, f.middle_initial, f.surname, f.suffix))
  from public.inventory_sessions s
  join public."usersData" u on u.id = s.created_by
  left join public."usersData" f on f.id = s.finished_by
  where s.id = p_session_id;
$$;
revoke all on function lirc_private.inventory_session_json(bigint)
  from public, anon, authenticated;

create or replace function lirc_private.inventory_entry_json(p_entry_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', e.id,
    'session_id', e.session_id,
    'accession_id', e.accession_id,
    'accession_number', a.accession_number,
    'book_id', b.id,
    'book_name', b.book_name,
    'outcome', e.outcome,
    'condition', e.condition,
    'recorded_at', e.recorded_at,
    'recorded_by', concat_ws(' ', u.first_name, u.middle_initial, u.surname, u.suffix))
  from public.inventory_entries e
  join public.book_accession_numbers a on a.id = e.accession_id
  join public.books b on b.id = a.book_id
  join public."usersData" u on u.id = e.recorded_by
  where e.id = p_entry_id;
$$;
revoke all on function lirc_private.inventory_entry_json(bigint)
  from public, anon, authenticated;

-- Live progress numbers for one session.
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
  where e.session_id = p_session_id;
  select count(*) filter (where l.id is null),
         count(*) filter (where l.id is not null)
    into v_not_checked, v_borrowed
  from public.book_accession_numbers a
  left join public.book_loans l
    on l.accession_id = a.id and l.returned_at is null
  where not exists (
    select 1 from public.inventory_entries e
    where e.session_id = p_session_id and e.accession_id = a.id);
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

-- The copy's current condition = its latest confirmed inventory record.
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
       order by e.recorded_at desc, e.id desc
       limit 1)
   where a.id = p_accession_id;
$$;
revoke all on function lirc_private.refresh_copy_condition(bigint)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: the open inventory (or none), with live counts and recent scans
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
    return jsonb_build_object('session', null, 'counts', null, 'recent', '[]'::jsonb);
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
    'recent', v_recent);
end $$;

-- ---------------------------------------------------------------------------
-- RPC: start a new inventory
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
    raise exception 'An inventory is already open. Continue that one or finish it first.';
  end if;
  insert into public.inventory_sessions (name, year, created_by)
  values (v_name, p_year, v_operator)
  returning id into v_session_id;
  return jsonb_build_object(
    'session', lirc_private.inventory_session_json(v_session_id),
    'counts', lirc_private.inventory_counts(v_session_id),
    'recent', '[]'::jsonb);
exception when unique_violation then
  raise exception 'An inventory is already open. Continue that one or finish it first.';
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
-- RPC: copies with no scan yet (review list), with search + pages
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
      where e.session_id = p_session_id and e.accession_id = a.id and e.outcome = 'Found')
    and (v_search = ''
      or a.accession_number ilike '%' || v_search || '%'
      or b.book_name ilike '%' || v_search || '%');

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
      on e.session_id = p_session_id and e.accession_id = a.id and e.outcome = 'Missing'
    where not exists (
        select 1 from public.inventory_entries f
        where f.session_id = p_session_id and f.accession_id = a.id and f.outcome = 'Found')
      and (v_search = ''
        or a.accession_number ilike '%' || v_search || '%'
        or b.book_name ilike '%' || v_search || '%')
    order by lower(a.accession_number), a.id
    limit v_limit offset v_offset
  ) x;

  return jsonb_build_object(
    'rows', v_rows,
    'total', v_total,
    'has_next', (v_offset + v_limit) < v_total);
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
-- RPC: finished inventories (history list)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_inventory_history(p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer;
begin
  if lirc_private.library_operator_id() is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  v_limit := least(greatest(coalesce(p_limit, 50), 1), 200);
  return jsonb_build_object('sessions', coalesce((
    select jsonb_agg(
             lirc_private.inventory_session_json(x.id)
             order by x.finished_at desc, x.id desc)
    from (
      select s.id, s.finished_at
      from public.inventory_sessions s
      where s.status = 'finished'
      order by s.finished_at desc, s.id desc
      limit v_limit
    ) x
  ), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------------
-- RPC: one inventory's records (history detail), with pages
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
  where e.session_id = p_session_id;
  select coalesce(jsonb_agg(
           lirc_private.inventory_entry_json(x.id)
           order by x.recorded_at desc, x.id desc), '[]'::jsonb)
    into v_rows
  from (
    select e.id, e.recorded_at
    from public.inventory_entries e
    where e.session_id = p_session_id
    order by e.recorded_at desc, e.id desc
    limit v_limit offset v_offset
  ) x;
  return jsonb_build_object(
    'rows', v_rows,
    'total', v_total,
    'has_next', (v_offset + v_limit) < v_total);
end $$;

-- ---------------------------------------------------------------------------
-- Keep the copy-removal message accurate now that inventory records exist
-- ---------------------------------------------------------------------------
create or replace function public.lirc_save_book_copies(
  p_book_id bigint,
  p_updates jsonb default '[]'::jsonb,
  p_new jsonb default '[]'::jsonb,
  p_delete_ids bigint[] default '{}'::bigint[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing jsonb := '[]'::jsonb;
  v_new_clean jsonb := '[]'::jsonb;
  v_update_map jsonb := '{}'::jsonb;
  v_keep_ids bigint[] := '{}';
  v_seen text[] := '{}';
  v_deleted int := 0;
  v_updated int := 0;
  v_added int := 0;
  v_id bigint;
  v_number text;
  v_clean jsonb;
  v_dupe text;
  item jsonb;
  rec record;
begin
  if not lirc_private.can_edit_catalog() then
    raise exception 'Librarian or admin access required.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.books b where b.id = p_book_id) then
    raise exception 'Book record not found.';
  end if;
  if p_updates is null or jsonb_typeof(p_updates) <> 'array'
     or p_new is null or jsonb_typeof(p_new) <> 'array' then
    raise exception 'Invalid changes.';
  end if;
  if jsonb_array_length(p_updates) > 200 or jsonb_array_length(p_new) > 200 then
    raise exception 'Too many changes at once.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id, 'accession_number', a.accession_number) order by a.id), '[]'::jsonb)
    into v_existing
  from public.book_accession_numbers a
  where a.book_id = p_book_id;

  if exists (
    select 1 from unnest(p_delete_ids) d
    where not exists (
      select 1 from public.book_accession_numbers a
      where a.id = d and a.book_id = p_book_id
    )
  ) then
    raise exception 'A copy to remove was not found on this book.';
  end if;

  for item in select value from jsonb_array_elements(p_updates) loop
    begin
      v_id := (item->>'id')::bigint;
    exception when others then
      raise exception 'Invalid change row.';
    end;
    if v_id = any (p_delete_ids) then
      raise exception 'A copy cannot be changed and removed at the same time.';
    end if;
    if not exists (
      select 1 from public.book_accession_numbers a
      where a.id = v_id and a.book_id = p_book_id
    ) then
      raise exception 'A copy to change was not found on this book.';
    end if;
    v_clean := lirc_private.clean_accession_item(item);
    v_update_map := jsonb_set(v_update_map, array[v_id::text], v_clean, true);
  end loop;

  select coalesce(jsonb_agg(lirc_private.clean_accession_item(x) order by ord), '[]'::jsonb)
    into v_new_clean
  from jsonb_array_elements(p_new) with ordinality as t(x, ord);

  for rec in
    select (e->>'id')::bigint as id, e->>'accession_number' as number
    from jsonb_array_elements(v_existing) e
  loop
    if rec.id = any (p_delete_ids) then
      continue;
    end if;
    v_keep_ids := v_keep_ids || rec.id;
    v_number := coalesce(
      (v_update_map -> rec.id::text) ->> 'accession_number',
      rec.number);
    if lower(v_number) = any (v_seen) then
      raise exception 'Accession number % appears twice.', v_number;
    end if;
    v_seen := v_seen || lower(v_number);
  end loop;
  for item in select value from jsonb_array_elements(v_new_clean) loop
    v_number := item->>'accession_number';
    if lower(v_number) = any (v_seen) then
      raise exception 'Accession number % appears twice.', v_number;
    end if;
    v_seen := v_seen || lower(v_number);
  end loop;

  select a.accession_number into v_dupe
  from public.book_accession_numbers a
  where lower(a.accession_number) = any (v_seen)
    and a.id <> all (v_keep_ids)
  limit 1;
  if v_dupe is not null then
    raise exception 'Accession number % already belongs to another copy.', v_dupe;
  end if;

  if array_length(p_delete_ids, 1) is not null then
    begin
      delete from public.book_accession_numbers
       where id = any (p_delete_ids) and book_id = p_book_id;
      get diagnostics v_deleted = row_count;
    exception when foreign_key_violation then
      raise exception 'A copy that has loan or inventory records cannot be removed. Its history must stay.';
    end;
  end if;

  for rec in select key::bigint as id, value as clean from jsonb_each(v_update_map) loop
    update public.book_accession_numbers a
       set accession_number = rec.clean->>'accession_number',
           shelf_id = (rec.clean->>'shelf_id')::bigint
     where a.id = rec.id and a.book_id = p_book_id;
    v_updated := v_updated + 1;
  end loop;

  for item in select value from jsonb_array_elements(v_new_clean) loop
    insert into public.book_accession_numbers
      (book_id, accession_number, status, shelf_id)
    values
      (p_book_id, item->>'accession_number', 'Available',
       (item->>'shelf_id')::bigint);
    v_added := v_added + 1;
  end loop;

  return jsonb_build_object('updated', v_updated, 'deleted', v_deleted, 'added', v_added);
end $$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function
  public.lirc_inventory_state(),
  public.lirc_inventory_start(text, integer),
  public.lirc_inventory_scan(bigint, text, text),
  public.lirc_inventory_update_entry(bigint, text),
  public.lirc_inventory_set_missing(bigint, bigint, boolean),
  public.lirc_inventory_unscanned(bigint, text, integer, integer),
  public.lirc_inventory_finish(bigint),
  public.lirc_inventory_history(integer),
  public.lirc_inventory_entries(bigint, integer, integer)
  from public, anon;
grant execute on function
  public.lirc_inventory_state(),
  public.lirc_inventory_start(text, integer),
  public.lirc_inventory_scan(bigint, text, text),
  public.lirc_inventory_update_entry(bigint, text),
  public.lirc_inventory_set_missing(bigint, bigint, boolean),
  public.lirc_inventory_unscanned(bigint, text, integer, integer),
  public.lirc_inventory_finish(bigint),
  public.lirc_inventory_history(integer),
  public.lirc_inventory_entries(bigint, integer, integer)
  to authenticated;

notify pgrst, 'reload schema';
commit;
