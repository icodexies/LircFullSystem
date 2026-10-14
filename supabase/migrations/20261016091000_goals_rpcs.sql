-- ============================================================================
-- Stage 2b: goals and contribution accounting — RPCs
--
-- Every function is SECURITY DEFINER with an in-function role guard.
-- Aggregates are computed here, never in the client:
--   team progress  = accepted completed items / baseline items      (C/B)
--   contribution   = personal accepted units / baseline items      (P/B pp)
--   share          = personal accepted units / team accepted units  (P/C)
-- Reviewer units are stored but excluded from contribution/share math.
-- Scope changes are only ever recorded through goal_scope_revisions.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- Shared aggregate summary (server-computed)
-- ---------------------------------------------------------------------------
create or replace function lirc_private.goal_summary_json(p_goal_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_baseline integer;
  v_completed integer;
  v_verified integer;
  v_open integer;
  v_excluded integer;
  v_team_units numeric;
begin
  select coalesce(g.baseline_count, 0) into v_baseline
  from public.work_goals g where g.id = p_goal_id;
  select count(*) filter (where i.state = 'completed'),
         count(*) filter (where i.state = 'verified'),
         count(*) filter (where i.state = 'open'),
         count(*) filter (where i.state = 'excluded')
    into v_completed, v_verified, v_open, v_excluded
  from public.goal_items i where i.goal_id = p_goal_id;
  select coalesce(sum(c.units), 0) into v_team_units
  from public.goal_contributions c
  where c.goal_id = p_goal_id and c.kind = 'work' and c.status = 'awarded';
  return jsonb_build_object(
    'baseline_count', v_baseline,
    'completed', v_completed,
    'verified', v_verified,
    'open', v_open,
    'excluded', v_excluded,
    'team_units', v_team_units,
    'team_progress_pct',
      case when v_baseline > 0
        then round(v_completed::numeric * 100 / v_baseline, 1)
        else null end);
end $$;
revoke all on function lirc_private.goal_summary_json(bigint)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Builder: item snapshot per type (used by activation and scope adds)
-- ---------------------------------------------------------------------------
create or replace function lirc_private.goal_item_snapshot(
  p_item_type text,
  p_item_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  if p_item_type = 'accession_copy' then
    select jsonb_build_object(
             'accession_number', a.accession_number,
             'book_id', b.id,
             'book_name', b.book_name)
      into v
    from public.book_accession_numbers a
    join public.books b on b.id = a.book_id
    where a.id = p_item_id;
  elsif p_item_type in ('title', 'book') then
    select jsonb_build_object('book_name', b.book_name)
      into v from public.books b where b.id = p_item_id;
  elsif p_item_type = 'loan' then
    select jsonb_build_object(
             'accession_id', l.accession_id,
             'borrowed_at', l.borrowed_at,
             'user_profile_id', l.user_profile_id)
      into v from public.book_loans l where l.id = p_item_id;
  elsif p_item_type = 'member' then
    select jsonb_build_object(
             'library_id', u.library_id,
             'role', u.role,
             'name', concat_ws(' ', u.surname || ',', u.first_name,
                               u.middle_initial, u.suffix))
      into v from public."usersData" u where u.id = p_item_id;
  elsif p_item_type = 'barcode_number' then
    select jsonb_build_object('accession_number', e.accession_number)
      into v from public.barcode_entries e where e.id = p_item_id;
  else
    raise exception 'Unknown goal item type: %.', p_item_type;
  end if;
  if v is null then
    raise exception 'Record % of type % was not found.', p_item_id, p_item_type;
  end if;
  return v;
end $$;
revoke all on function lirc_private.goal_item_snapshot(text, bigint)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: create a draft goal (admin)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_goal_create(
  p_goal_type text,
  p_name text,
  p_description text default null,
  p_scope jsonb default '{}'::jsonb,
  p_policy jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operator bigint := lirc_private.my_profile_id();
  v_name text;
  v_goal_id bigint;
  v_policy jsonb := coalesce(p_policy, '{}'::jsonb);
  v_bad_key text;
begin
  if not lirc_private.is_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  perform lirc_private.activity_context('goal.create', 'work_goals');
  if p_goal_type not in ('inventory', 'call_number', 'loans', 'members',
                         'barcode', 'attendance', 'academic_periods') then
    raise exception 'Unknown goal type.';
  end if;
  v_name := btrim(coalesce(p_name, ''));
  if v_name = '' then
    raise exception 'Give the goal a name.';
  end if;
  if char_length(v_name) > 200 then
    raise exception 'Goal name must be 200 characters or fewer.';
  end if;
  select k into v_bad_key
  from jsonb_object_keys(v_policy) as k
  where k not in ('review_requirement', 'loan_policy', 'credit_split', 'note')
  limit 1;
  if v_bad_key is not null then
    raise exception 'Unknown goal policy setting: %.', v_bad_key;
  end if;
  if v_policy ? 'review_requirement'
     and (v_policy ->> 'review_requirement') not in ('none', 'single', 'two_person') then
    raise exception 'review_requirement must be none, single or two_person.';
  end if;
  if v_policy ? 'loan_policy'
     and (v_policy ->> 'loan_policy') not in ('human_verify', 'exclude') then
    raise exception 'loan_policy must be human_verify or exclude.';
  end if;
  if v_policy ? 'credit_split' then
    if jsonb_typeof(v_policy -> 'credit_split') <> 'object' then
      raise exception 'credit_split must be an object.';
    end if;
  end if;

  insert into public.work_goals
    (goal_type, name, description, scope, policy, created_by)
  values
    (p_goal_type, v_name, nullif(btrim(coalesce(p_description, '')), ''),
     coalesce(p_scope, '{}'::jsonb), v_policy, v_operator)
  returning id into v_goal_id;

  perform lirc_private.record_activity(
    p_action => 'goal.create',
    p_entity_type => 'work_goals',
    p_entity_id => v_goal_id,
    p_source => 'app',
    p_meta => jsonb_build_object('goal_type', p_goal_type, 'name', v_name));

  return jsonb_build_object(
    'goal', jsonb_build_object(
      'id', v_goal_id, 'goal_type', p_goal_type, 'name', v_name,
      'status', 'draft', 'policy', v_policy, 'scope',
      coalesce(p_scope, '{}'::jsonb)));
end $$;
revoke all on function public.lirc_goal_create(text, text, text, jsonb, jsonb)
  from public, anon;
grant execute on function public.lirc_goal_create(text, text, text, jsonb, jsonb)
  to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: activate a draft goal (freezes the scope; admin)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_goal_activate(p_goal_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.work_goals%ROWTYPE;
  v_count integer := 0;
  v_session bigint;
  v_from timestamptz;
  v_to timestamptz;
  v_loan_policy text;
begin
  if not lirc_private.is_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  perform lirc_private.activity_context('goal.activate', 'work_goals');
  select * into g from public.work_goals where id = p_goal_id for update;
  if not found then
    raise exception 'Goal not found.';
  end if;
  if g.status <> 'draft' then
    raise exception 'This goal was already activated (status: %).', g.status;
  end if;
  v_loan_policy := coalesce(g.policy ->> 'loan_policy', 'human_verify');

  if g.goal_type = 'inventory' then
    v_session := nullif(g.scope ->> 'session_id', '')::bigint;
    if v_session is null
       or not exists (select 1 from public.inventory_sessions s where s.id = v_session) then
      raise exception 'Give the goal a real inventory session (scope.session_id).';
    end if;
    insert into public.goal_items (goal_id, item_type, item_id, snapshot)
    select g.id, 'accession_copy', a.id,
           jsonb_build_object(
             'accession_number', a.accession_number,
             'book_id', b.id,
             'book_name', b.book_name)
    from public.book_accession_numbers a
    join public.books b on b.id = a.book_id
    where v_loan_policy <> 'exclude'
       or not exists (
         select 1 from public.book_loans l
         where l.accession_id = a.id and l.returned_at is null);
    get diagnostics v_count = row_count;

  elsif g.goal_type = 'call_number' then
    insert into public.goal_items (goal_id, item_type, item_id, snapshot)
    select g.id, 'title', b.id, jsonb_build_object('book_name', b.book_name)
    from public.books b
    where b.call_number is null or btrim(b.call_number) = '';
    get diagnostics v_count = row_count;

  elsif g.goal_type = 'loans' then
    v_from := nullif(g.scope ->> 'from', '')::timestamptz;
    v_to := nullif(g.scope ->> 'to', '')::timestamptz;
    if v_from is null or v_to is null or v_to <= v_from then
      raise exception 'Loan goals need a date range (scope.from / scope.to).';
    end if;
    insert into public.goal_items (goal_id, item_type, item_id, snapshot)
    select g.id, 'loan', l.id,
           jsonb_build_object(
             'accession_id', l.accession_id,
             'borrowed_at', l.borrowed_at,
             'user_profile_id', l.user_profile_id)
    from public.book_loans l
    where l.borrowed_at >= v_from and l.borrowed_at < v_to;
    get diagnostics v_count = row_count;

  elsif g.goal_type = 'barcode' then
    v_from := nullif(g.scope ->> 'from', '')::timestamptz;
    v_to := nullif(g.scope ->> 'to', '')::timestamptz;
    if v_from is null or v_to is null or v_to <= v_from then
      raise exception 'Barcode goals need a date range (scope.from / scope.to).';
    end if;
    insert into public.goal_items (goal_id, item_type, item_id, snapshot)
    select g.id, 'barcode_number', e.id,
           jsonb_build_object('accession_number', e.accession_number)
    from public.barcode_entries e
    where e.added_at >= v_from and e.added_at < v_to;
    get diagnostics v_count = row_count;

  elsif g.goal_type = 'members' then
    if jsonb_typeof(g.scope -> 'ids') <> 'array' then
      raise exception 'Member goals need an explicit id list (scope.ids).';
    end if;
    insert into public.goal_items (goal_id, item_type, item_id, snapshot)
    select g.id, 'member', u.id,
           jsonb_build_object(
             'library_id', u.library_id,
             'role', u.role,
             'name', concat_ws(' ', u.surname || ',', u.first_name,
                               u.middle_initial, u.suffix))
    from public."usersData" u
    where u.id = any (
      select (value #>> '{}')::bigint
      from jsonb_array_elements(g.scope -> 'ids'));
    get diagnostics v_count = row_count;

  else
    raise exception 'This goal type has no scope items yet.';
  end if;

  update public.work_goals
     set baseline_count = v_count,
         status = 'active',
         activated_at = now()
   where id = p_goal_id;

  insert into public.goal_scope_revisions
    (goal_id, revision, kind, baseline_before, baseline_after, item_refs,
     reason, created_by)
  values
    (p_goal_id, 1, 'initial', null, v_count,
     jsonb_build_object('count', v_count),
     'Scope frozen at activation.', lirc_private.my_profile_id());

  perform lirc_private.record_activity(
    p_action => 'goal.activate',
    p_entity_type => 'work_goals',
    p_entity_id => p_goal_id,
    p_source => 'app',
    p_meta => jsonb_build_object(
      'goal_type', g.goal_type, 'baseline_count', v_count));

  return jsonb_build_object(
    'goal_id', p_goal_id,
    'baseline_count', v_count,
    'summary', lirc_private.goal_summary_json(p_goal_id));
end $$;
revoke all on function public.lirc_goal_activate(bigint)
  from public, anon;
grant execute on function public.lirc_goal_activate(bigint)
  to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: goal membership (admin)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_goal_set_member(
  p_goal_id bigint,
  p_profile_id bigint,
  p_role text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  if not lirc_private.is_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  perform lirc_private.activity_context('goal.member.set', 'goal_members');
  if p_role not in ('worker', 'reviewer', 'viewer') then
    raise exception 'Membership role must be worker, reviewer or viewer.';
  end if;
  if not exists (select 1 from public.work_goals g where g.id = p_goal_id) then
    raise exception 'Goal not found.';
  end if;
  select u.role::text into v_role
  from public."usersData" u where u.id = p_profile_id;
  if v_role is null then
    raise exception 'Profile not found.';
  end if;
  if v_role not in ('staff', 'librarian', 'admin') then
    raise exception 'Only library personnel can join a goal.';
  end if;

  insert into public.goal_members (goal_id, profile_id, role, added_by)
  values (p_goal_id, p_profile_id, p_role, lirc_private.my_profile_id())
  on conflict (goal_id, profile_id)
    do update set role = excluded.role,
                  added_by = excluded.added_by,
                  added_at = now();

  perform lirc_private.record_activity(
    p_action => 'goal.member.set',
    p_entity_type => 'goal_members',
    p_entity_id => p_profile_id,
    p_source => 'app',
    p_meta => jsonb_build_object(
      'goal_id', p_goal_id, 'profile_id', p_profile_id, 'role', p_role));

  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.lirc_goal_set_member(bigint, bigint, text)
  from public, anon;
grant execute on function public.lirc_goal_set_member(bigint, bigint, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: revise the frozen scope (admin; every change is a revision)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_goal_revise_scope(
  p_goal_id bigint,
  p_kind text,
  p_items jsonb,
  p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.work_goals%ROWTYPE;
  v_revision integer;
  v_before integer;
  v_added integer := 0;
  v_excluded integer := 0;
  v_refs jsonb := '[]'::jsonb;
  v_item jsonb;
  v_item_id bigint;
  v_type text;
  v_ins integer;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_goal_item public.goal_items%ROWTYPE;
  v_award record;
begin
  if not lirc_private.is_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  perform lirc_private.activity_context('goal.scope.revise', 'work_goals');
  select * into g from public.work_goals where id = p_goal_id for update;
  if not found then
    raise exception 'Goal not found.';
  end if;
  if g.status not in ('active', 'paused') then
    raise exception 'Scope can only change while the goal is active or paused.';
  end if;
  if p_kind not in ('add', 'remove', 'exclude', 'defect') then
    raise exception 'Unknown revision kind.';
  end if;
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'Provide an array of items.';
  end if;
  if p_kind <> 'add' and v_reason is null then
    raise exception 'Give a reason for removing or excluding items.';
  end if;
  v_before := coalesce(g.baseline_count, 0);

  if p_kind = 'add' then
    for v_item in select value from jsonb_array_elements(p_items) loop
      v_type := v_item ->> 'item_type';
      v_item_id := nullif(v_item ->> 'item_id', '')::bigint;
      if v_type is null or v_item_id is null then
        raise exception 'Each added item needs item_type and item_id.';
      end if;
      insert into public.goal_items (goal_id, item_type, item_id, snapshot)
      values (p_goal_id, v_type, v_item_id,
              lirc_private.goal_item_snapshot(v_type, v_item_id))
      on conflict (goal_id, item_type, item_id) do nothing;
      get diagnostics v_ins = row_count;
      if v_ins > 0 then
        v_added := v_added + 1;
        v_refs := v_refs || jsonb_build_array(
          jsonb_build_object('item_type', v_type, 'item_id', v_item_id));
      end if;
    end loop;
    update public.work_goals
       set baseline_count = v_before + v_added
     where id = p_goal_id;

  else
    for v_item in select value from jsonb_array_elements(p_items) loop
      v_item_id := coalesce(
        nullif(v_item ->> 'goal_item_id', '')::bigint,
        case when jsonb_typeof(v_item) = 'number'
             then (v_item #>> '{}')::bigint end);
      if v_item_id is null then
        raise exception 'Each removed item needs a goal_item_id.';
      end if;
      select * into v_goal_item
      from public.goal_items
      where id = v_item_id and goal_id = p_goal_id
      for update;
      if not found then
        raise exception 'Goal item % is not part of this goal.', v_item_id;
      end if;
      if v_goal_item.state = 'excluded' then
        continue;
      end if;
      -- reverse every live work award on the item (history stays visible)
      for v_award in
        select c.id from public.goal_contributions c
        where c.goal_item_id = v_item_id
          and c.kind = 'work'
          and c.status = 'awarded'
      loop
        perform lirc_private.goal_reverse_award(
          v_award.id,
          'Scope revised (' || p_kind || '): ' || coalesce(v_reason, ''));
      end loop;
      update public.goal_items
         set state = 'excluded',
             excluded_reason = v_reason
       where id = v_item_id;
      v_excluded := v_excluded + 1;
      v_refs := v_refs || jsonb_build_array(v_item_id);
    end loop;
    update public.work_goals
       set baseline_count = greatest(v_before - v_excluded, 0)
     where id = p_goal_id;
  end if;

  select coalesce(max(r.revision), 0) + 1 into v_revision
  from public.goal_scope_revisions r where r.goal_id = p_goal_id;

  insert into public.goal_scope_revisions
    (goal_id, revision, kind, baseline_before, baseline_after, item_refs,
     reason, created_by)
  values
    (p_goal_id, v_revision, p_kind, v_before,
     (select baseline_count from public.work_goals where id = p_goal_id),
     v_refs, v_reason, lirc_private.my_profile_id());

  perform lirc_private.record_activity(
    p_action => 'goal.scope.revise',
    p_entity_type => 'work_goals',
    p_entity_id => p_goal_id,
    p_source => 'app',
    p_reason => v_reason,
    p_meta => jsonb_build_object(
      'kind', p_kind, 'added', v_added, 'excluded', v_excluded,
      'baseline_before', v_before));

  return jsonb_build_object(
    'revision', v_revision,
    'added', v_added,
    'excluded', v_excluded,
    'summary', lirc_private.goal_summary_json(p_goal_id));
end $$;
revoke all on function public.lirc_goal_revise_scope(bigint, text, jsonb, text)
  from public, anon;
grant execute on function public.lirc_goal_revise_scope(bigint, text, jsonb, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: pause / resume / complete (admin)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_goal_pause(p_goal_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if not lirc_private.is_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  perform lirc_private.activity_context('goal.pause', 'work_goals');
  select g.status into v_status
  from public.work_goals g where g.id = p_goal_id for update;
  if not found then
    raise exception 'Goal not found.';
  end if;
  if v_status <> 'active' then
    raise exception 'Only an active goal can be paused (status: %).', v_status;
  end if;
  update public.work_goals set status = 'paused' where id = p_goal_id;
  perform lirc_private.record_activity(
    p_action => 'goal.pause', p_entity_type => 'work_goals',
    p_entity_id => p_goal_id, p_source => 'app');
  return jsonb_build_object('status', 'paused');
end $$;
revoke all on function public.lirc_goal_pause(bigint) from public, anon;
grant execute on function public.lirc_goal_pause(bigint) to authenticated;

create or replace function public.lirc_goal_resume(p_goal_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if not lirc_private.is_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  perform lirc_private.activity_context('goal.resume', 'work_goals');
  select g.status into v_status
  from public.work_goals g where g.id = p_goal_id for update;
  if not found then
    raise exception 'Goal not found.';
  end if;
  if v_status <> 'paused' then
    raise exception 'Only a paused goal can be resumed (status: %).', v_status;
  end if;
  update public.work_goals set status = 'active' where id = p_goal_id;
  perform lirc_private.record_activity(
    p_action => 'goal.resume', p_entity_type => 'work_goals',
    p_entity_id => p_goal_id, p_source => 'app');
  return jsonb_build_object('status', 'active');
end $$;
revoke all on function public.lirc_goal_resume(bigint) from public, anon;
grant execute on function public.lirc_goal_resume(bigint) to authenticated;

create or replace function public.lirc_goal_complete(p_goal_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if not lirc_private.is_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  perform lirc_private.activity_context('goal.complete', 'work_goals');
  select g.status into v_status
  from public.work_goals g where g.id = p_goal_id for update;
  if not found then
    raise exception 'Goal not found.';
  end if;
  if v_status not in ('active', 'paused') then
    raise exception 'Only an active or paused goal can be completed (status: %).', v_status;
  end if;
  -- Outstanding items stay open: completing the goal is an operation, not a
  -- wipe. Nothing is deleted and no item changes state here.
  update public.work_goals
     set status = 'completed',
         closed_by = lirc_private.my_profile_id(),
         closed_at = now()
   where id = p_goal_id;
  perform lirc_private.record_activity(
    p_action => 'goal.complete', p_entity_type => 'work_goals',
    p_entity_id => p_goal_id, p_source => 'app');
  return jsonb_build_object(
    'status', 'completed',
    'summary', lirc_private.goal_summary_json(p_goal_id));
end $$;
revoke all on function public.lirc_goal_complete(bigint) from public, anon;
grant execute on function public.lirc_goal_complete(bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: review one item (librarian/admin per policy)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_goal_review_item(
  p_goal_item_id bigint,
  p_accept boolean,
  p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.goal_items%ROWTYPE;
  g public.work_goals%ROWTYPE;
  v_me bigint := lirc_private.my_profile_id();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_reviews integer;
  v_required text;
begin
  if not (lirc_private.can_edit_catalog() or lirc_private.is_admin()) then
    raise exception 'Librarian or admin access required.' using errcode = '42501';
  end if;
  select * into i from public.goal_items where id = p_goal_item_id for update;
  if not found then
    raise exception 'Goal item not found.';
  end if;
  select * into g from public.work_goals where id = i.goal_id;
  if g.status <> 'active' then
    raise exception 'This goal is % — reviews need it active.', g.status;
  end if;
  if not lirc_private.is_admin()
     and exists (select 1 from public.goal_members m
                  where m.goal_id = g.id and m.role = 'reviewer')
     and not lirc_private.is_goal_member(g.id, array['reviewer']) then
    raise exception 'You are not a reviewer for this goal.' using errcode = '42501';
  end if;
  perform lirc_private.activity_context('goal.review', 'goal_items');

  if not p_accept then
    if v_reason is null then
      raise exception 'Give a reason for rejecting.';
    end if;
    perform lirc_private.record_activity(
      p_action => 'goal.review.reject',
      p_entity_type => 'goal_items',
      p_entity_id => p_goal_item_id,
      p_source => 'app',
      p_reason => v_reason);
    return jsonb_build_object(
      'accepted', false,
      'state', i.state,
      'summary', lirc_private.goal_summary_json(g.id));
  end if;

  -- accepted review: one review unit per reviewer per item (dupes rejected)
  begin
    perform lirc_private.goal_award(
      p_goal_item_id, v_me, 'review', 1,
      coalesce(v_reason, 'Review accepted'));
  exception when unique_violation then
    raise exception 'You already reviewed this item.';
  end;
  perform lirc_private.goal_maybe_complete(p_goal_item_id);

  v_reviews := lirc_private.goal_review_count(p_goal_item_id);
  v_required := coalesce(g.policy ->> 'review_requirement', 'none');
  select * into i from public.goal_items where id = p_goal_item_id;

  return jsonb_build_object(
    'accepted', true,
    'reviews_accepted', v_reviews,
    'review_requirement', v_required,
    'state', i.state,
    'summary', lirc_private.goal_summary_json(g.id));
end $$;
revoke all on function public.lirc_goal_review_item(bigint, boolean, text)
  from public, anon;
grant execute on function public.lirc_goal_review_item(bigint, boolean, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: goal list (aggregates + my own numbers)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_goal_list(p_include_closed boolean default true)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me bigint := lirc_private.my_profile_id();
  v_rows jsonb;
begin
  if v_me is null then
    raise exception 'No library profile for this account.' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', g.id,
    'goal_type', g.goal_type,
    'name', g.name,
    'description', g.description,
    'status', g.status,
    'created_at', g.created_at,
    'activated_at', g.activated_at,
    'closed_at', g.closed_at,
    'revisions', (select count(*) from public.goal_scope_revisions r
                   where r.goal_id = g.id),
    'my_role', (select m.role from public.goal_members m
                 where m.goal_id = g.id and m.profile_id = v_me),
    'my', jsonb_build_object(
      'units', coalesce((select sum(c.units) from public.goal_contributions c
                          where c.goal_id = g.id and c.kind = 'work'
                            and c.status = 'awarded'
                            and c.contributor_profile_id = v_me), 0),
      'items', (select count(*) from public.goal_contributions c
                 where c.goal_id = g.id and c.kind = 'work'
                   and c.status = 'awarded'
                   and c.contributor_profile_id = v_me)),
    'summary', lirc_private.goal_summary_json(g.id))
    order by
      case g.status when 'active' then 0 when 'paused' then 1 else 2 end,
      g.id desc), '[]'::jsonb)
  into v_rows
  from public.work_goals g
  where (p_include_closed or g.status not in ('completed', 'cancelled'))
    and (lirc_private.is_admin() or lirc_private.is_goal_member(g.id));
  return jsonb_build_object('goals', v_rows);
end $$;
revoke all on function public.lirc_goal_list(boolean)
  from public, anon;
grant execute on function public.lirc_goal_list(boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: one goal in full (aggregates server-side; per-person only for admin)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_goal_get(p_goal_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  g public.work_goals%ROWTYPE;
  v_me bigint := lirc_private.my_profile_id();
  v_admin boolean := lirc_private.is_admin();
  v_summary jsonb;
  v_my_units numeric;
  v_team_units numeric;
  v_baseline integer;
  v_my jsonb;
  v_contributors jsonb := '[]'::jsonb;
  v_completeness jsonb;
begin
  if v_me is null then
    raise exception 'No library profile for this account.' using errcode = '42501';
  end if;
  select * into g from public.work_goals where id = p_goal_id;
  if not found then
    raise exception 'Goal not found.';
  end if;
  if not (v_admin or lirc_private.is_goal_member(p_goal_id)) then
    raise exception 'You are not a member of this goal.' using errcode = '42501';
  end if;

  v_summary := lirc_private.goal_summary_json(p_goal_id);
  v_baseline := coalesce((v_summary ->> 'baseline_count')::integer, 0);
  v_team_units := (v_summary ->> 'team_units')::numeric;
  select coalesce(sum(c.units), 0) into v_my_units
  from public.goal_contributions c
  where c.goal_id = p_goal_id and c.kind = 'work'
    and c.status = 'awarded' and c.contributor_profile_id = v_me;

  v_my := jsonb_build_object(
    'profile_id', v_me,
    'role', (select m.role from public.goal_members m
              where m.goal_id = p_goal_id and m.profile_id = v_me),
    'units', v_my_units,
    'items', (select count(*) from public.goal_contributions c
               where c.goal_id = p_goal_id and c.kind = 'work'
                 and c.status = 'awarded' and c.contributor_profile_id = v_me),
    'reversed', (select count(*) from public.goal_contributions c
                  where c.goal_id = p_goal_id and c.kind = 'work'
                    and c.status = 'awarded' and c.reversal_of_id is null
                    and c.contributor_profile_id = v_me
                    and exists (select 1 from public.goal_contributions r
                                 where r.reversal_of_id = c.id)),
    'contribution_pp',
      case when v_baseline > 0
        then round(v_my_units * 100 / v_baseline, 1) else null end,
    'share_pct',
      case when v_team_units > 0
        then round(v_my_units * 100 / v_team_units, 1) else null end);

  if v_admin then
    select coalesce(jsonb_agg(jsonb_build_object(
      'profile_id', x.contributor_profile_id,
      'name', concat_ws(' ', u.surname || ',', u.first_name,
                        u.middle_initial, u.suffix),
      'role', u.role,
      'units', x.units,
      'items', x.items)
      order by x.units desc, x.contributor_profile_id), '[]'::jsonb)
    into v_contributors
    from (
      select c.contributor_profile_id,
             sum(c.units) as units,
             count(*) as items
      from public.goal_contributions c
      where c.goal_id = p_goal_id and c.kind = 'work'
        and c.status = 'awarded'
      group by c.contributor_profile_id
    ) x
    join public."usersData" u on u.id = x.contributor_profile_id;
  end if;

  if g.goal_type = 'call_number' then
    v_completeness := jsonb_build_object(
      'titles_total', (select count(*) from public.books),
      'titles_with_call_number',
        (select count(*) from public.books b
          where b.call_number is not null and btrim(b.call_number) <> ''),
      'pct', (select round(
        count(*) filter (where b.call_number is not null
                           and btrim(b.call_number) <> '')::numeric * 100
        / greatest(count(*), 1), 1)
        from public.books b));
  end if;

  return jsonb_build_object(
    'goal', jsonb_build_object(
      'id', g.id,
      'goal_type', g.goal_type,
      'name', g.name,
      'description', g.description,
      'status', g.status,
      'scope', g.scope,
      'policy', g.policy,
      'baseline_count', g.baseline_count,
      'created_at', g.created_at,
      'created_by', (select concat_ws(' ', u.surname || ',', u.first_name,
                                      u.middle_initial, u.suffix)
                      from public."usersData" u where u.id = g.created_by),
      'activated_at', g.activated_at,
      'closed_at', g.closed_at,
      'closed_by', (select concat_ws(' ', u.surname || ',', u.first_name,
                                     u.middle_initial, u.suffix)
                     from public."usersData" u where u.id = g.closed_by)),
    'summary', v_summary,
    'me', v_my,
    'members', (select coalesce(jsonb_agg(jsonb_build_object(
                  'profile_id', m.profile_id,
                  'name', concat_ws(' ', u.surname || ',', u.first_name,
                                    u.middle_initial, u.suffix),
                  'role', m.role)
                  order by m.role, m.profile_id), '[]'::jsonb)
                from public.goal_members m
                join public."usersData" u on u.id = m.profile_id
                where m.goal_id = p_goal_id),
    'revisions', (select coalesce(jsonb_agg(jsonb_build_object(
                    'revision', r.revision,
                    'kind', r.kind,
                    'baseline_before', r.baseline_before,
                    'baseline_after', r.baseline_after,
                    'item_refs', r.item_refs,
                    'reason', r.reason,
                    'created_at', r.created_at,
                    'created_by', concat_ws(' ', u.surname || ',', u.first_name,
                                            u.middle_initial, u.suffix))
                    order by r.revision), '[]'::jsonb)
                  from public.goal_scope_revisions r
                  left join public."usersData" u on u.id = r.created_by
                  where r.goal_id = p_goal_id),
    'contributors', case when v_admin then v_contributors else null end,
    'catalog_completeness', v_completeness);
end $$;
revoke all on function public.lirc_goal_get(bigint)
  from public, anon;
grant execute on function public.lirc_goal_get(bigint)
  to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: my credited items (own data)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_goal_my_contribution(
  p_goal_id bigint,
  p_page integer default 1,
  p_page_size integer default 25)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me bigint := lirc_private.my_profile_id();
  v_page integer;
  v_size integer;
  v_total bigint;
  v_rows jsonb;
begin
  if v_me is null then
    raise exception 'No library profile for this account.' using errcode = '42501';
  end if;
  if not (lirc_private.is_admin() or lirc_private.is_goal_member(p_goal_id)) then
    raise exception 'You are not a member of this goal.' using errcode = '42501';
  end if;
  v_page := greatest(coalesce(p_page, 1), 1);
  v_size := least(greatest(coalesce(p_page_size, 25), 1), 100);

  select count(*) into v_total
  from public.goal_contributions c
  where c.goal_id = p_goal_id and c.kind = 'work'
    and c.contributor_profile_id = v_me
    and c.reversal_of_id is null;

  select coalesce(jsonb_agg(jsonb_build_object(
    'contribution_id', c.id,
    'goal_item_id', c.goal_item_id,
    'item_type', i.item_type,
    'item_id', i.item_id,
    'snapshot', i.snapshot,
    'state', i.state,
    'units', c.units,
    'status', c.status,
    'awarded_at', c.awarded_at,
    'reversed_at', c.reversed_at,
    'reversal_reason', (select r.note from public.goal_contributions r
                         where r.reversal_of_id = c.id),
    'note', c.note,
    'activity_event_id', c.activity_event_id)
    order by c.awarded_at desc, c.id desc), '[]'::jsonb)
  into v_rows
  from (
    select * from public.goal_contributions c
    where c.goal_id = p_goal_id and c.kind = 'work'
      and c.contributor_profile_id = v_me
      and c.reversal_of_id is null
    order by c.awarded_at desc, c.id desc
    limit v_size offset (v_page - 1) * v_size
  ) c
  join public.goal_items i on i.id = c.goal_item_id;

  return jsonb_build_object(
    'rows', v_rows,
    'total', v_total,
    'has_next', (v_page * v_size) < v_total,
    'units', coalesce((select sum(c.units) from public.goal_contributions c
                        where c.goal_id = p_goal_id and c.kind = 'work'
                          and c.status = 'awarded'
                          and c.contributor_profile_id = v_me), 0),
    'items', (select count(*) from public.goal_contributions c
               where c.goal_id = p_goal_id and c.kind = 'work'
                 and c.status = 'awarded'
                 and c.contributor_profile_id = v_me));
end $$;
revoke all on function public.lirc_goal_my_contribution(bigint, integer, integer)
  from public, anon;
grant execute on function public.lirc_goal_my_contribution(bigint, integer, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: reconciliation report (admin; read-only verification helper)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_goal_reconcile(p_goal_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  g public.work_goals%ROWTYPE;
  v_active_items integer;
  v_completed_no_credit integer;
  v_over_one integer;
  v_awards_without_event integer;
  v_open_with_full_credit integer;
  v_revision_delta integer;
begin
  if not lirc_private.is_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  select * into g from public.work_goals where id = p_goal_id;
  if not found then
    raise exception 'Goal not found.';
  end if;

  select count(*) into v_active_items
  from public.goal_items i
  where i.goal_id = p_goal_id and i.state <> 'excluded';

  select count(*) into v_completed_no_credit
  from public.goal_items i
  where i.goal_id = p_goal_id and i.state = 'completed'
    and lirc_private.goal_net_work_units(i.id) <> 1;

  select count(*) into v_over_one
  from (
    select i.id
    from public.goal_items i
    where i.goal_id = p_goal_id
    group by i.id
    having lirc_private.goal_net_work_units(i.id) > 1
  ) x;

  select count(*) into v_awards_without_event
  from public.goal_contributions c
  where c.goal_id = p_goal_id and c.status = 'awarded'
    and c.activity_event_id is null;

  select count(*) into v_open_with_full_credit
  from public.goal_items i
  where i.goal_id = p_goal_id and i.state = 'open'
    and lirc_private.goal_net_work_units(i.id) = 1
    and lirc_private.goal_reviews_met(i.id);

  select coalesce(sum(
           case when r.baseline_after is not null and r.baseline_before is not null
                then r.baseline_after - r.baseline_before else 0 end), 0)
    into v_revision_delta
  from public.goal_scope_revisions r
  where r.goal_id = p_goal_id and r.kind <> 'initial';

  return jsonb_build_object(
    'goal_id', p_goal_id,
    'baseline_recorded', coalesce(g.baseline_count, 0),
    'items_active', v_active_items,
    'baseline_matches_items', coalesce(g.baseline_count, 0) = v_active_items,
    'initial_count_matches_activation',
      (select r.baseline_after from public.goal_scope_revisions r
        where r.goal_id = p_goal_id and r.kind = 'initial') is not null,
    'revision_delta', v_revision_delta,
    'completed_without_credit', v_completed_no_credit,
    'credits_over_one', v_over_one,
    'awards_without_event', v_awards_without_event,
    'completable_open_items', v_open_with_full_credit,
    'all_clear', v_completed_no_credit = 0 and v_over_one = 0
      and v_awards_without_event = 0
      and coalesce(g.baseline_count, 0) = v_active_items);
end $$;
revoke all on function public.lirc_goal_reconcile(bigint)
  from public, anon;
grant execute on function public.lirc_goal_reconcile(bigint)
  to authenticated;

notify pgrst, 'reload schema';
commit;
