-- ============================================================================
-- Stage 2a: goals and contribution accounting — schema
--
-- Design (decision 2026-10-14, recommended options):
--   * work_goals       — one goal per pilot (inventory / call_number / ...)
--   * goal_items       — the FROZEN eligible set (created at activation)
--   * goal_members     — who works / reviews / watches the goal
--   * goal_scope_revisions — every scope change, explicit and reported
--   * goal_contributions   — append-only credit ledger
--
-- Ledger model:
--   * award   = row with status='awarded' (units > 0)
--   * reverse = the award row flips to status='reversed' AND a compensating
--               row is inserted (status='reversed', reversal_of_id = award).
--               Nothing is ever deleted; history stays visible.
--   * live work units per item <= 1 (trigger); an item reaches
--     state='completed' only with EXACTLY 1 live work unit and the goal's
--     review requirement met. state='verified' = resolved without credit.
--   * review/verify rows are stored but excluded from contribution math.
--
-- Credit is only ever written by the SECURITY DEFINER helpers below; no
-- client role may touch these tables (RLS + revoked grants).
--
-- Per-person rows are readable by the admin and by the person themselves
-- (librarian decision: aggregate reporting only).
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
create table if not exists public.work_goals (
  id bigint generated always as identity primary key,
  goal_type text not null
    check (goal_type in ('inventory', 'call_number', 'loans', 'members',
                         'barcode', 'attendance', 'academic_periods')),
  name text not null,
  description text,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'completed', 'cancelled')),
  scope jsonb not null default '{}'::jsonb,
  policy jsonb not null default '{}'::jsonb,
  baseline_count integer,
  created_by bigint not null references public."usersData"(id) on delete restrict,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  closed_by bigint references public."usersData"(id) on delete restrict,
  closed_at timestamptz
);

create table if not exists public.goal_items (
  id bigint generated always as identity primary key,
  goal_id bigint not null references public.work_goals(id) on delete cascade,
  item_type text not null
    check (item_type in ('accession_copy', 'title', 'book', 'loan',
                         'member', 'barcode_number')),
  item_id bigint not null,
  snapshot jsonb not null default '{}'::jsonb,
  state text not null default 'open'
    check (state in ('open', 'completed', 'verified', 'excluded')),
  excluded_reason text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (goal_id, item_type, item_id)
);

create table if not exists public.goal_members (
  id bigint generated always as identity primary key,
  goal_id bigint not null references public.work_goals(id) on delete cascade,
  profile_id bigint not null references public."usersData"(id) on delete cascade,
  role text not null check (role in ('worker', 'reviewer', 'viewer')),
  added_by bigint not null references public."usersData"(id) on delete restrict,
  added_at timestamptz not null default now(),
  unique (goal_id, profile_id)
);

create table if not exists public.goal_scope_revisions (
  id bigint generated always as identity primary key,
  goal_id bigint not null references public.work_goals(id) on delete cascade,
  revision integer not null,
  kind text not null check (kind in ('initial', 'add', 'remove', 'exclude', 'defect')),
  baseline_before integer,
  baseline_after integer,
  item_refs jsonb not null default '[]'::jsonb,
  reason text,
  created_by bigint not null references public."usersData"(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (goal_id, revision)
);

create table if not exists public.goal_contributions (
  id bigint generated always as identity primary key,
  goal_id bigint not null references public.work_goals(id) on delete cascade,
  goal_item_id bigint not null references public.goal_items(id) on delete cascade,
  contributor_profile_id bigint not null
    references public."usersData"(id) on delete restrict,
  contributor_role_at_time text,
  kind text not null check (kind in ('work', 'review', 'verify')),
  units numeric(4,2) not null check (units > 0 and units <= 1),
  status text not null default 'awarded'
    check (status in ('awarded', 'reversed')),
  awarded_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversal_of_id bigint references public.goal_contributions(id),
  operation_id uuid,
  activity_event_id bigint references public.activity_events(id),
  note text,
  -- An award never points at another row. A compensating row does
  -- (reversal_of_id = the award it cancels). A flipped award keeps
  -- reversal_of_id null: its history stays visible and re-awarding the same
  -- (item, contributor, kind) is possible again after a reversal.
  check ((status = 'awarded' and reversal_of_id is null)
      or (status = 'reversed'))
);

-- ---------------------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------------------
create index if not exists work_goals_status_idx
  on public.work_goals (status, goal_type);
create index if not exists goal_items_goal_state_idx
  on public.goal_items (goal_id, state);
create index if not exists goal_items_lookup_idx
  on public.goal_items (goal_id, item_type, item_id);
create index if not exists goal_members_goal_idx
  on public.goal_members (goal_id, role);
create index if not exists goal_scope_revisions_goal_idx
  on public.goal_scope_revisions (goal_id, revision desc);
-- one live award per (item, contributor, kind)
create unique index if not exists goal_contributions_one_award
  on public.goal_contributions (goal_item_id, contributor_profile_id, kind)
  where status = 'awarded';
create index if not exists goal_contributions_item_idx
  on public.goal_contributions (goal_item_id, status, kind);
create index if not exists goal_contributions_contributor_idx
  on public.goal_contributions (contributor_profile_id, goal_id, status);

-- link events back to goal items (column already existed in activity_events)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'activity_events_goal_item_fkey') then
    alter table public.activity_events
      add constraint activity_events_goal_item_fkey
      foreign key (related_goal_item_id) references public.goal_items(id)
      on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Helpers used by guards and RPCs
-- ---------------------------------------------------------------------------

-- record_activity is extended with related_goal_item_id so goal events link
-- straight to their item. The Stage 1a version is replaced (same body plus
-- the extra column); every existing caller keeps working.
drop function if exists lirc_private.record_activity(
  text, text, bigint, text, text, text, bigint, jsonb, text, jsonb, uuid, bigint);

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
  p_correction_of_id bigint default null,
  p_related_goal_item_id bigint default null)
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
    parent_type, parent_id, changes, reason, meta, correction_of_id,
    related_goal_item_id)
  values (
    v_actor.profile_id, v_actor.user_id, v_actor.role, v_kind, v_source,
    v_op, p_action, p_entity_type, p_entity_id,
    p_parent_type, p_parent_id, coalesce(p_changes, '{}'::jsonb),
    p_reason, coalesce(p_meta, '{}'::jsonb), p_correction_of_id,
    p_related_goal_item_id)
  returning id into v_event_id;

  return v_event_id;
end $$;
revoke all on function lirc_private.record_activity(
  text, text, bigint, text, text, text, bigint, jsonb, text, jsonb, uuid,
  bigint, bigint)
  from public, anon, authenticated;

create or replace function lirc_private.is_goal_member(
  p_goal_id bigint,
  p_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.goal_members m
    where m.goal_id = p_goal_id
      and m.profile_id = lirc_private.my_profile_id()
      and (p_roles is null or m.role = any(p_roles)));
$$;
revoke all on function lirc_private.is_goal_member(bigint, text[])
  from public, anon, authenticated;

-- live work units on an item (accepted credit only; reverses removed)
create or replace function lirc_private.goal_net_work_units(p_item_id bigint)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(c.units), 0)::numeric
  from public.goal_contributions c
  where c.goal_item_id = p_item_id
    and c.kind = 'work'
    and c.status = 'awarded';
$$;
revoke all on function lirc_private.goal_net_work_units(bigint)
  from public, anon, authenticated;

-- distinct accepted reviewers for an item
create or replace function lirc_private.goal_review_count(p_item_id bigint)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct c.contributor_profile_id)::integer
  from public.goal_contributions c
  where c.goal_item_id = p_item_id
    and c.kind = 'review'
    and c.status = 'awarded';
$$;
revoke all on function lirc_private.goal_review_count(bigint)
  from public, anon, authenticated;

-- does the item satisfy its goal's review policy?
create or replace function lirc_private.goal_reviews_met(p_item_id bigint)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_requirement text;
begin
  select coalesce(g.policy ->> 'review_requirement', 'none')
    into v_requirement
  from public.goal_items i
  join public.work_goals g on g.id = i.goal_id
  where i.id = p_item_id;
  v_requirement := coalesce(v_requirement, 'none');
  if v_requirement = 'none' then
    return true;
  end if;
  if v_requirement = 'single' then
    return lirc_private.goal_review_count(p_item_id) >= 1;
  end if;
  -- two_person
  return lirc_private.goal_review_count(p_item_id) >= 2;
end $$;
revoke all on function lirc_private.goal_reviews_met(bigint)
  from public, anon, authenticated;

-- completion gate: exactly 1 live work unit + reviews met
create or replace function lirc_private.goal_maybe_complete(p_item_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.goal_items%ROWTYPE;
begin
  select * into i from public.goal_items where id = p_item_id for update;
  if not found then
    return false;
  end if;
  if i.state not in ('open') then
    return false;
  end if;
  if lirc_private.goal_net_work_units(p_item_id) <> 1 then
    return false;
  end if;
  if not lirc_private.goal_reviews_met(p_item_id) then
    return false;
  end if;
  update public.goal_items
     set state = 'completed', resolved_at = now()
   where id = p_item_id;
  return true;
end $$;
revoke all on function lirc_private.goal_maybe_complete(bigint)
  from public, anon, authenticated;

-- award credit (the ONLY writer of awards). Returns the contribution id.
create or replace function lirc_private.goal_award(
  p_goal_item_id bigint,
  p_profile_id bigint,
  p_kind text,
  p_units numeric,
  p_note text default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.goal_items%ROWTYPE;
  g public.work_goals%ROWTYPE;
  v_role text;
  v_event bigint;
  v_op uuid;
  v_id bigint;
begin
  if p_kind not in ('work', 'review', 'verify') then
    raise exception 'Unknown credit kind.';
  end if;
  if p_units is null or p_units <= 0 or p_units > 1 then
    raise exception 'Credit units must be above 0 and at most 1.';
  end if;
  select * into i from public.goal_items where id = p_goal_item_id for update;
  if not found then
    raise exception 'Goal item not found.';
  end if;
  select * into g from public.work_goals where id = i.goal_id;
  if g.status <> 'active' then
    raise exception 'This goal is % — credit can only be recorded while it is active.', g.status;
  end if;
  if i.state = 'excluded' then
    raise exception 'This item was excluded from the goal.';
  end if;
  select u.role::text into v_role from public."usersData" u where u.id = p_profile_id;
  if v_role is null then
    raise exception 'Contributor profile not found.';
  end if;

  -- one activity event per award; the ledger row links to it (event first so
  -- the credit row is inserted complete, in a single append-only insert)
  v_event := lirc_private.record_activity(
    p_action => 'goal.credit.award',
    p_entity_type => 'goal_items',
    p_entity_id => p_goal_item_id,
    p_source => 'app',
    p_meta => jsonb_build_object(
      'goal_id', i.goal_id,
      'kind', p_kind,
      'units', p_units,
      'contributor_profile_id', p_profile_id),
    p_related_goal_item_id => p_goal_item_id);
  select e.operation_id into v_op from public.activity_events e where e.id = v_event;

  insert into public.goal_contributions
    (goal_id, goal_item_id, contributor_profile_id, contributor_role_at_time,
     kind, units, note, activity_event_id, operation_id)
  values
    (i.goal_id, p_goal_item_id, p_profile_id, v_role, p_kind, p_units, p_note,
     v_event, v_op)
  returning id into v_id;

  if p_kind = 'work' then
    perform lirc_private.goal_maybe_complete(p_goal_item_id);
  end if;
  return v_id;
end $$;
revoke all on function lirc_private.goal_award(bigint, bigint, text, numeric, text)
  from public, anon, authenticated;

-- reverse a credit (award stays visible; compensating row is added)
create or replace function lirc_private.goal_reverse_award(
  p_contribution_id bigint,
  p_reason text default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.goal_contributions%ROWTYPE;
  v_event bigint;
  v_op uuid;
  v_id bigint;
begin
  select * into c from public.goal_contributions
   where id = p_contribution_id
   for update;
  if not found then
    raise exception 'Credit row not found.';
  end if;
  if c.status <> 'awarded' or c.reversal_of_id is not null then
    raise exception 'This credit was already reversed.';
  end if;

  v_event := lirc_private.record_activity(
    p_action => 'goal.credit.reverse',
    p_entity_type => 'goal_items',
    p_entity_id => c.goal_item_id,
    p_source => 'app',
    p_reason => p_reason,
    p_meta => jsonb_build_object(
      'goal_id', c.goal_id,
      'kind', c.kind,
      'units', c.units,
      'contributor_profile_id', c.contributor_profile_id,
      'reversed_contribution_id', c.id),
    p_related_goal_item_id => c.goal_item_id);
  select e.operation_id into v_op from public.activity_events e where e.id = v_event;

  update public.goal_contributions
     set status = 'reversed', reversed_at = now()
   where id = c.id;

  insert into public.goal_contributions
    (goal_id, goal_item_id, contributor_profile_id, contributor_role_at_time,
     kind, units, status, awarded_at, reversed_at, reversal_of_id, note,
     activity_event_id, operation_id)
  values
    (c.goal_id, c.goal_item_id, c.contributor_profile_id,
     c.contributor_role_at_time, c.kind, c.units, 'reversed',
     c.awarded_at, now(), c.id, p_reason, v_event, v_op)
  returning id into v_id;

  -- reopen the item when its accepted credit is gone
  if c.kind = 'work' then
    if lirc_private.goal_net_work_units(c.goal_item_id) = 0 then
      update public.goal_items
         set state = 'open', resolved_at = null
       where id = c.goal_item_id
         and state in ('completed', 'verified');
    end if;
  end if;
  return v_id;
end $$;
revoke all on function lirc_private.goal_reverse_award(bigint, text)
  from public, anon, authenticated;

-- resolve an item without credit (e.g. on-loan copy human-verified)
create or replace function lirc_private.goal_mark_verified(
  p_goal_item_id bigint,
  p_reason text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.goal_items
     set state = 'verified', resolved_at = now()
   where id = p_goal_item_id
     and state = 'open';
  if not found then
    return false;
  end if;
  perform lirc_private.record_activity(
    p_action => 'goal.item.verified',
    p_entity_type => 'goal_items',
    p_entity_id => p_goal_item_id,
    p_source => 'app',
    p_reason => p_reason);
  return true;
end $$;
revoke all on function lirc_private.goal_mark_verified(bigint, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Guards
-- ---------------------------------------------------------------------------
-- credits: validate on insert; only the reversal flip may update; no deletes
create or replace function lirc_private.goal_contribution_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_live numeric;
begin
  if tg_op = 'INSERT' then
    if new.status = 'awarded' then
      if new.kind = 'work' then
        select coalesce(sum(c.units), 0) into v_live
        from public.goal_contributions c
        where c.goal_item_id = new.goal_item_id
          and c.kind = 'work'
          and c.status = 'awarded';
        if v_live + new.units > 1 then
          raise exception 'This item already carries one full unit of work credit.';
        end if;
      end if;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.goal_id <> old.goal_id
       or new.goal_item_id <> old.goal_item_id
       or new.contributor_profile_id <> old.contributor_profile_id
       or new.contributor_role_at_time is distinct from old.contributor_role_at_time
       or new.kind <> old.kind
       or new.units <> old.units
       or new.awarded_at <> old.awarded_at
       or new.reversal_of_id is distinct from old.reversal_of_id
       or new.note is distinct from old.note
       or new.activity_event_id is distinct from old.activity_event_id
       or new.operation_id is distinct from old.operation_id then
      raise exception 'A credit row can only change through a reversal.';
    end if;
    if not (old.status = 'awarded' and new.status = 'reversed'
            and new.reversed_at is not null) then
      raise exception 'Only an awarded credit may be reversed.';
    end if;
    if exists (
      select 1 from public.goal_contributions c
      where c.reversal_of_id = old.id) then
      raise exception 'This credit was already reversed.';
    end if;
    return new;
  end if;

  raise exception 'Credit rows are append-only.';
end $$;
revoke all on function lirc_private.goal_contribution_guard()
  from public, anon, authenticated;

drop trigger if exists goal_contributions_guard on public.goal_contributions;
create trigger goal_contributions_guard
  before insert or update or delete on public.goal_contributions
  for each row execute function lirc_private.goal_contribution_guard();

-- items: identity is frozen; completion needs exactly one accepted unit
create or replace function lirc_private.goal_item_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.goal_id <> old.goal_id
     or new.item_type <> old.item_type
     or new.item_id <> old.item_id
     or new.snapshot is distinct from old.snapshot
     or new.created_at <> old.created_at then
    raise exception 'A goal item''s identity cannot change.';
  end if;
  if new.state <> old.state then
    if new.state = 'excluded' then
      if coalesce(btrim(new.excluded_reason), '') = '' then
        raise exception 'Excluding an item needs a reason.';
      end if;
    end if;
    if new.state = 'completed' then
      if lirc_private.goal_net_work_units(new.id) <> 1 then
        raise exception 'An item completes only with exactly one unit of accepted credit.';
      end if;
      if not lirc_private.goal_reviews_met(new.id) then
        raise exception 'The goal''s review requirement is not met yet.';
      end if;
      new.resolved_at := coalesce(new.resolved_at, now());
    end if;
    if new.state = 'verified' then
      new.resolved_at := coalesce(new.resolved_at, now());
    end if;
    if new.state = 'open' then
      new.resolved_at := null;
    end if;
  end if;
  return new;
end $$;
revoke all on function lirc_private.goal_item_guard()
  from public, anon, authenticated;

drop trigger if exists goal_items_guard on public.goal_items;
create trigger goal_items_guard
  before update on public.goal_items
  for each row execute function lirc_private.goal_item_guard();

drop trigger if exists goal_items_no_delete on public.goal_items;
create trigger goal_items_no_delete
  before delete on public.goal_items
  for each row execute function lirc_private.guard_append_only();

-- scope revisions are append-only
drop trigger if exists goal_scope_revisions_append_only
  on public.goal_scope_revisions;
create trigger goal_scope_revisions_append_only
  before update or delete on public.goal_scope_revisions
  for each row execute function lirc_private.guard_append_only();

drop trigger if exists goal_members_no_delete on public.goal_members;
create trigger goal_members_no_delete
  before delete on public.goal_members
  for each row execute function lirc_private.guard_append_only();

-- ---------------------------------------------------------------------------
-- 5. RLS + grants (read-only to clients; writes only via definer functions)
-- ---------------------------------------------------------------------------
alter table public.work_goals enable row level security;
alter table public.goal_items enable row level security;
alter table public.goal_members enable row level security;
alter table public.goal_scope_revisions enable row level security;
alter table public.goal_contributions enable row level security;

drop policy if exists work_goals_read on public.work_goals;
create policy work_goals_read on public.work_goals
  for select to authenticated
  using (lirc_private.is_admin() or lirc_private.is_goal_member(id));

drop policy if exists goal_items_read on public.goal_items;
create policy goal_items_read on public.goal_items
  for select to authenticated
  using (lirc_private.is_admin() or lirc_private.is_goal_member(goal_id));

drop policy if exists goal_members_read on public.goal_members;
create policy goal_members_read on public.goal_members
  for select to authenticated
  using (lirc_private.is_admin()
         or profile_id = lirc_private.my_profile_id()
         or lirc_private.is_goal_member(goal_id));

drop policy if exists goal_scope_revisions_read on public.goal_scope_revisions;
create policy goal_scope_revisions_read on public.goal_scope_revisions
  for select to authenticated
  using (lirc_private.is_admin() or lirc_private.is_goal_member(goal_id));

drop policy if exists goal_contributions_read on public.goal_contributions;
create policy goal_contributions_read on public.goal_contributions
  for select to authenticated
  using (lirc_private.is_admin()
         or contributor_profile_id = lirc_private.my_profile_id());

revoke all on table public.work_goals from public, anon, authenticated;
revoke all on table public.goal_items from public, anon, authenticated;
revoke all on table public.goal_members from public, anon, authenticated;
revoke all on table public.goal_scope_revisions from public, anon, authenticated;
revoke all on table public.goal_contributions from public, anon, authenticated;
grant select on table public.work_goals to authenticated;
grant select on table public.goal_items to authenticated;
grant select on table public.goal_members to authenticated;
grant select on table public.goal_scope_revisions to authenticated;
grant select on table public.goal_contributions to authenticated;

notify pgrst, 'reload schema';
commit;
