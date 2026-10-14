-- ============================================================================
-- Stage 1a: activity event infrastructure (APPEND ONLY, SERVER FIRST)
--
-- Written against the LIVE definitions verified on 2026-10-14:
--   - 21 public tables, RLS on all, helper schema lirc_private
--   - guard helpers: library_operator_id / attendance_staff_id /
--     can_edit_catalog / is_admin / my_profile_id (all SECURITY DEFINER)
--   - no anon grants except get_my_role
--
-- Contents:
--   1. public.activity_events  (successful/history events, append-only)
--   2. public.security_events  (denied attempts; separate table, admin read)
--   3. append-only guards (reject UPDATE/DELETE unless lirc.maintenance=on)
--   4. lirc_private: current_actor, record_activity, activity_context,
--      activity_whitelist, activity_changes, capture_table_activity,
--      log_security_event
--   5. AFTER triggers on the 12 tracked tables
--
-- Conventions (context GUCs set by existing RPCs via activity_context):
--   lirc.action          logical action name (e.g. 'inventory.scan')
--   lirc.operation_id    one per user action; groups all rows it wrote
--   lirc.primary_table   the table the action's main entity lives in
--   lirc.parent_event_id id of the first activity_event of the operation
--   lirc.reason          optional human reason
--   lirc.source          optional source override
--   lirc.maintenance     'on' during labelled backfills/maintenance
--
-- Actor is ALWAYS derived from auth.uid() inside the database. No actor is
-- ever accepted as a parameter. Only whitelisted, non-secret columns are
-- captured in `changes`.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. activity_events
-- ---------------------------------------------------------------------------
create table if not exists public.activity_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default clock_timestamp(),
  actor_profile_id bigint references public."usersData"(id),
  actor_user_id uuid,
  actor_role text,
  actor_kind text not null default 'unknown'
    check (actor_kind in ('user', 'system', 'migration', 'unknown')),
  source text not null default 'direct_table'
    check (source in ('app', 'direct_table', 'import', 'migration', 'system', 'auto')),
  operation_id uuid not null default gen_random_uuid(),
  action text not null,
  entity_type text not null,
  entity_id bigint,
  parent_type text,
  parent_id bigint,
  related_goal_item_id bigint,
  correction_of_id bigint references public.activity_events(id),
  changes jsonb not null default '{}'::jsonb,
  reason text,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists activity_events_actor_idx
  on public.activity_events (actor_profile_id, occurred_at desc, id desc);
create index if not exists activity_events_entity_idx
  on public.activity_events (entity_type, entity_id, occurred_at desc);
create index if not exists activity_events_action_idx
  on public.activity_events (action, occurred_at desc);
create index if not exists activity_events_operation_idx
  on public.activity_events (operation_id);
create index if not exists activity_events_goal_item_idx
  on public.activity_events (related_goal_item_id);
create index if not exists activity_events_time_idx
  on public.activity_events (occurred_at desc, id desc);

alter table public.activity_events enable row level security;

-- Own events only (any linked member can read what they did themselves).
drop policy if exists activity_events_own_select on public.activity_events;
create policy activity_events_own_select on public.activity_events
  for select to authenticated
  using (actor_profile_id = lirc_private.my_profile_id());

-- Admin sees everything. (Librarian team visibility decision: aggregate-only,
-- so no raw per-person policy here; team aggregates are RPC-computed later.)
drop policy if exists activity_events_admin_select on public.activity_events;
create policy activity_events_admin_select on public.activity_events
  for select to authenticated
  using (lirc_private.is_admin());

-- No client role may write events directly; triggers/definer functions do.
revoke all on table public.activity_events from public, anon, authenticated;
grant select on table public.activity_events to authenticated;

-- ---------------------------------------------------------------------------
-- 2. security_events (separate from history; admin read only)
--
-- NOTE (deviation, documented): PostgreSQL rolls back a transaction when it
-- raises, so a denied attempt can never be logged from inside the same
-- raising transaction. Denied attempts are recorded through the guarded
-- lirc_report_security_event RPC called by the client after it catches the
-- error, or by definer functions when they deny without raising.
-- ---------------------------------------------------------------------------
create table if not exists public.security_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default clock_timestamp(),
  actor_profile_id bigint references public."usersData"(id),
  actor_user_id uuid,
  actor_role text,
  event text not null,
  detail jsonb not null default '{}'::jsonb
);

create index if not exists security_events_time_idx
  on public.security_events (occurred_at desc, id desc);

alter table public.security_events enable row level security;

drop policy if exists security_events_admin_select on public.security_events;
create policy security_events_admin_select on public.security_events
  for select to authenticated
  using (lirc_private.is_admin());

revoke all on table public.security_events from public, anon, authenticated;
grant select on table public.security_events to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Append-only guards
-- ---------------------------------------------------------------------------
create or replace function lirc_private.guard_append_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('lirc.maintenance', true), '') = 'on' then
    return coalesce(new, old);
  end if;
  raise exception 'This record is append-only and cannot be changed.'
    using errcode = '42501';
end $$;
revoke all on function lirc_private.guard_append_only()
  from public, anon, authenticated;

drop trigger if exists activity_events_append_only on public.activity_events;
create trigger activity_events_append_only
  before update or delete on public.activity_events
  for each row execute function lirc_private.guard_append_only();

drop trigger if exists security_events_append_only on public.security_events;
create trigger security_events_append_only
  before update or delete on public.security_events
  for each row execute function lirc_private.guard_append_only();

-- ---------------------------------------------------------------------------
-- 4. Actor + context helpers
-- ---------------------------------------------------------------------------
create or replace function lirc_private.current_actor()
returns table (profile_id bigint, user_id uuid, role text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.user_id, u.role::text
  from public."usersData" u
  where u.user_id = (select auth.uid())
  limit 1;
$$;
revoke all on function lirc_private.current_actor()
  from public, anon, authenticated;

-- Called by the existing RPCs as a 1-line prologue: names the action, marks
-- the primary table and opens one operation id for the whole call.
create or replace function lirc_private.activity_context(
  p_action text,
  p_primary_table text,
  p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('lirc.action', p_action, true);
  perform set_config('lirc.primary_table', p_primary_table, true);
  if p_reason is not null then
    perform set_config('lirc.reason', p_reason, true);
  end if;
  if coalesce(current_setting('lirc.operation_id', true), '') = '' then
    perform set_config('lirc.operation_id', gen_random_uuid()::text, true);
  end if;
end $$;
revoke all on function lirc_private.activity_context(text, text, text)
  from public, anon, authenticated;

-- The single write path for activity_events. Actor is derived, never passed.
create or replace function lirc_private.record_activity(
  p_action text,
  p_entity_type text,
  p_entity_id bigint default null,
  p_source text default null,
  p_actor_kind text default null,
  p_parent_type text default null,
  p_parent_id bigint default null,
  p_changes jsonb default '{}'::jsonb,
  p_reason text default null,
  p_meta jsonb default '{}'::jsonb,
  p_operation_id uuid default null,
  p_correction_of_id bigint default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_op uuid;
  v_source text;
  v_kind text;
  v_event_id bigint;
begin
  select * into v_actor from lirc_private.current_actor();

  v_op := coalesce(
    p_operation_id,
    nullif(current_setting('lirc.operation_id', true), '')::uuid,
    gen_random_uuid());

  v_source := coalesce(
    p_source,
    nullif(current_setting('lirc.source', true), ''),
    'direct_table');

  if p_actor_kind is not null then
    v_kind := p_actor_kind;
  elsif coalesce(current_setting('lirc.maintenance', true), '') = 'on' then
    v_kind := 'migration';
  elsif v_actor.profile_id is not null then
    v_kind := 'user';
  else
    v_kind := 'unknown';
  end if;

  insert into public.activity_events (
    actor_profile_id, actor_user_id, actor_role, actor_kind, source,
    operation_id, action, entity_type, entity_id,
    parent_type, parent_id, changes, reason, meta, correction_of_id)
  values (
    v_actor.profile_id, v_actor.user_id, v_actor.role, v_kind, v_source,
    v_op, p_action, p_entity_type, p_entity_id,
    p_parent_type, p_parent_id, coalesce(p_changes, '{}'::jsonb),
    p_reason, coalesce(p_meta, '{}'::jsonb), p_correction_of_id)
  returning id into v_event_id;

  return v_event_id;
end $$;
revoke all on function lirc_private.record_activity(
  text, text, bigint, text, text, text, bigint, jsonb, text, jsonb, uuid, bigint)
  from public, anon, authenticated;

-- Guarded logger for denied attempts (called AFTER the raising call failed).
create or replace function lirc_private.log_security_event(
  p_event text,
  p_detail jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  v_event_id bigint;
  v_detail jsonb;
begin
  select * into v_actor from lirc_private.current_actor();
  v_detail := coalesce(p_detail, '{}'::jsonb);
  -- keep the detail small and free of anything secret
  v_detail := (
    select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
    from jsonb_each(v_detail)
    where key in ('action', 'entity_type', 'entity_id', 'page', 'route', 'message')
  );
  if char_length(p_event) > 80 then
    raise exception 'Security event name is too long.';
  end if;
  insert into public.security_events (
    actor_profile_id, actor_user_id, actor_role, event, detail)
  values (v_actor.profile_id, v_actor.user_id, v_actor.role,
          p_event, v_detail)
  returning id into v_event_id;
  return v_event_id;
end $$;
revoke all on function lirc_private.log_security_event(text, jsonb)
  from public, anon, authenticated;

-- Public entry so the app can report a denied attempt it caught.
create or replace function public.lirc_report_security_event(
  p_event text,
  p_detail jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event text;
begin
  if lirc_private.my_profile_id() is null then
    raise exception 'No library profile for this account.' using errcode = '42501';
  end if;
  v_event := btrim(coalesce(p_event, ''));
  if v_event not in ('permission_denied', 'not_found', 'invalid_input') then
    raise exception 'Unknown security event.';
  end if;
  perform lirc_private.log_security_event(v_event, p_detail);
end $$;
revoke all on function public.lirc_report_security_event(text, jsonb)
  from public, anon;
grant execute on function public.lirc_report_security_event(text, jsonb)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Whitelisted change capture
-- ---------------------------------------------------------------------------
create or replace function lirc_private.activity_whitelist(p_table text)
returns text[]
language sql
immutable
as $$
  select case p_table
    when 'usersData' then
      array['role', 'library_id', 'department_id', 'program_id',
            'position_classification_id']::text[]
    when 'student_enrollments' then
      array['status', 'year_level', 'year_level_source',
            'academic_year_id', 'validated_by']::text[]
    when 'attendance' then
      array['time_in', 'time_out', 'purpose_of_visit', 'role_at_visit',
            'year_level', 'semester_id']::text[]
    when 'semesters' then
      array['name', 'starts_on', 'ends_on', 'is_active', 'academic_year_id']::text[]
    when 'academic_years' then
      array['name', 'start_year', 'starts_on', 'ends_on']::text[]
    when 'books' then
      array['book_name', 'author', 'isbn', 'call_number', 'publish_year',
            'edition', 'publisher', 'place_of_publication',
            'barcode_tag_number', 'asset_number', 'shelf_id',
            'book_format_id']::text[]
    when 'book_accession_numbers' then
      array['accession_number', 'status', 'condition', 'shelf_id',
            'book_id']::text[]
    when 'book_loans' then
      array['borrowed_at', 'due_at', 'returned_at', 'user_profile_id',
            'accession_id', 'returned_by']::text[]
    when 'inventory_sessions' then
      array['name', 'year', 'status', 'finished_by', 'paused_by']::text[]
    when 'inventory_entries' then
      array['outcome', 'condition', 'voided_at', 'voided_reason']::text[]
    when 'barcode_entries' then
      array['accession_number', 'template_id', 'templated_at']::text[]
    when 'barcode_templates' then
      array['name', 'item_count']::text[]
    else '{}'::text[]
  end;
$$;
revoke all on function lirc_private.activity_whitelist(text)
  from public, anon, authenticated;

create or replace function lirc_private.activity_changes(
  p_table text,
  p_op text,
  p_old jsonb,
  p_new jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cols text[] := lirc_private.activity_whitelist(p_table);
  v_col text;
  v_out jsonb := '{}'::jsonb;
  v_old jsonb;
  v_new jsonb;
begin
  if v_cols is null or array_length(v_cols, 1) is null then
    return '{}'::jsonb;
  end if;
  foreach v_col in array v_cols loop
    if p_op = 'INSERT' then
      if p_new ? v_col then
        v_out := v_out || jsonb_build_object(v_col, p_new -> v_col);
      end if;
    elsif p_op = 'DELETE' then
      if p_old ? v_col then
        v_out := v_out || jsonb_build_object(v_col, p_old -> v_col);
      end if;
    else
      v_old := p_old -> v_col;
      v_new := p_new -> v_col;
      if v_old is distinct from v_new then
        v_out := v_out || jsonb_build_object(
          v_col, jsonb_build_object('from', v_old, 'to', v_new));
      end if;
    end if;
  end loop;
  return v_out;
end $$;
revoke all on function lirc_private.activity_changes(text, text, jsonb, jsonb)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Generic row capture
-- ---------------------------------------------------------------------------
create or replace function lirc_private.capture_table_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ctx_action text := nullif(current_setting('lirc.action', true), '');
  v_primary text := nullif(current_setting('lirc.primary_table', true), '');
  v_reason text := nullif(current_setting('lirc.reason', true), '');
  v_action text;
  v_source text;
  v_actor_kind text := null;
  v_parent_type text := null;
  v_parent_id bigint := null;
  v_changes jsonb;
  v_entity_id bigint;
  v_event_id bigint;
  v_is_primary boolean;
begin
  v_changes := lirc_private.activity_changes(
    tg_table_name, tg_op, to_jsonb(old), to_jsonb(new));

  -- Nothing whitelisted changed: do not record noise.
  if tg_op = 'UPDATE' and v_changes = '{}'::jsonb then
    return new;
  end if;

  v_entity_id := coalesce(
    (to_jsonb(new) ->> 'id')::bigint,
    (to_jsonb(old) ->> 'id')::bigint);

  v_is_primary := v_ctx_action is not null
    and (v_primary is null or v_primary = tg_table_name);

  if v_is_primary then
    v_action := v_ctx_action;
    v_source := coalesce(nullif(current_setting('lirc.source', true), ''), 'app');
  elsif v_ctx_action is not null then
    -- automatic side effect inside a known operation
    v_action := v_ctx_action || '.auto';
    v_source := 'auto';
    v_actor_kind := 'system';
    v_parent_type := v_primary;
    v_parent_id := nullif(current_setting('lirc.parent_event_id', true), '')::bigint;
  else
    -- direct table write (SQL console, manual fix, outside any RPC)
    v_action := tg_table_name || '.' || lower(tg_op);
    v_source := case
      when coalesce(current_setting('lirc.maintenance', true), '') = 'on'
        then 'migration'
      else 'direct_table'
    end;
  end if;

  v_event_id := lirc_private.record_activity(
    p_action => v_action,
    p_entity_type => tg_table_name,
    p_entity_id => v_entity_id,
    p_source => v_source,
    p_actor_kind => v_actor_kind,
    p_parent_type => v_parent_type,
    p_parent_id => v_parent_id,
    p_changes => v_changes,
    p_reason => v_reason,
    p_meta => jsonb_build_object('op', lower(tg_op)));

  -- The first primary event of an operation becomes the parent of its
  -- automatic side effects.
  if v_is_primary then
    perform set_config('lirc.parent_event_id', v_event_id::text, true);
  end if;

  return coalesce(new, old);
end $$;
revoke all on function lirc_private.capture_table_activity()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Triggers on the tracked tables (AFTER, row level)
-- ---------------------------------------------------------------------------
drop trigger if exists activity_capture on public."usersData";
create trigger activity_capture
  after insert or update or delete on public."usersData"
  for each row execute function lirc_private.capture_table_activity();

drop trigger if exists activity_capture on public.student_enrollments;
create trigger activity_capture
  after insert or update or delete on public.student_enrollments
  for each row execute function lirc_private.capture_table_activity();

drop trigger if exists activity_capture on public.attendance;
create trigger activity_capture
  after insert or update or delete on public.attendance
  for each row execute function lirc_private.capture_table_activity();

drop trigger if exists activity_capture on public.semesters;
create trigger activity_capture
  after insert or update or delete on public.semesters
  for each row execute function lirc_private.capture_table_activity();

drop trigger if exists activity_capture on public.academic_years;
create trigger activity_capture
  after insert or update or delete on public.academic_years
  for each row execute function lirc_private.capture_table_activity();

drop trigger if exists activity_capture on public.books;
create trigger activity_capture
  after insert or update or delete on public.books
  for each row execute function lirc_private.capture_table_activity();

drop trigger if exists activity_capture on public.book_accession_numbers;
create trigger activity_capture
  after insert or update or delete on public.book_accession_numbers
  for each row execute function lirc_private.capture_table_activity();

drop trigger if exists activity_capture on public.book_loans;
create trigger activity_capture
  after insert or update or delete on public.book_loans
  for each row execute function lirc_private.capture_table_activity();

drop trigger if exists activity_capture on public.inventory_sessions;
create trigger activity_capture
  after insert or update or delete on public.inventory_sessions
  for each row execute function lirc_private.capture_table_activity();

drop trigger if exists activity_capture on public.inventory_entries;
create trigger activity_capture
  after insert or update or delete on public.inventory_entries
  for each row execute function lirc_private.capture_table_activity();

drop trigger if exists activity_capture on public.barcode_entries;
create trigger activity_capture
  after insert or update or delete on public.barcode_entries
  for each row execute function lirc_private.capture_table_activity();

drop trigger if exists activity_capture on public.barcode_templates;
create trigger activity_capture
  after insert or update or delete on public.barcode_templates
  for each row execute function lirc_private.capture_table_activity();

notify pgrst, 'reload schema';
commit;
