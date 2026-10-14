-- ============================================================================
-- Stage 4a: personnel dashboard read model (RPCs)
--
--   * lirc_sign_in_activity   — sign-ins for self; everything for admins.
--     Uses the Supabase auth audit log when "Write audit logs to the
--     database" is enabled; otherwise falls back to auth.sessions and says
--     so honestly (with coverage dates).
--   * lirc_goal_review_queue  — items awaiting the caller's review.
--   * lirc_goal_my_contribution gains p_kind ('work' | 'review') so the
--     dashboard can show performed vs reviewed work separately.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. Sign-in activity
-- ---------------------------------------------------------------------------
create or replace function public.lirc_sign_in_activity(
  p_scope text default 'own',
  p_page_size integer default 10)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me bigint := lirc_private.my_profile_id();
  v_uid uuid;
  v_scope text := lower(btrim(coalesce(p_scope, 'own')));
  v_limit integer := least(greatest(coalesce(p_page_size, 10), 1), 50);
  v_audit_rows integer;
  v_rows jsonb;
  v_source text;
  v_total bigint;
  v_first timestamptz;
  v_last timestamptz;
begin
  if v_me is null then
    raise exception 'No library profile for this account.' using errcode = '42501';
  end if;
  if v_scope not in ('own', 'all') then
    raise exception 'Unknown scope.';
  end if;
  if v_scope = 'all' and not lirc_private.is_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  select u.user_id into v_uid from public."usersData" u where u.id = v_me;

  select count(*) into v_audit_rows
  from auth.audit_log_entries al
  where al.payload ->> 'action' in ('login', 'logout')
    and (v_scope = 'all' or al.payload ->> 'actor_id' = v_uid::text);

  if v_audit_rows > 0 then
    v_source := 'audit';
    select count(*), min(al.created_at), max(al.created_at)
      into v_total, v_first, v_last
    from auth.audit_log_entries al
    where al.payload ->> 'action' in ('login', 'logout')
      and (v_scope = 'all' or al.payload ->> 'actor_id' = v_uid::text);
    select coalesce(jsonb_agg(jsonb_build_object(
      'occurred_at', x.created_at,
      'action', case x.act when 'login' then 'Signed in'
                           when 'logout' then 'Signed out'
                           else x.act end,
      'actor_profile_id', u.id,
      'actor_name', concat_ws(' ', u.surname || ',', u.first_name,
                              u.middle_initial, u.suffix),
      'actor_role', u.role,
      'detail', x.actor_name)
      order by x.created_at desc), '[]'::jsonb)
    into v_rows
    from (
      select al.created_at,
             al.payload ->> 'action' as act,
             al.payload ->> 'actor_username' as actor_name,
             al.payload ->> 'actor_id' as actor_id
      from auth.audit_log_entries al
      where al.payload ->> 'action' in ('login', 'logout')
        and (v_scope = 'all' or al.payload ->> 'actor_id' = v_uid::text)
      order by al.created_at desc
      limit v_limit
    ) x
    left join public."usersData" u on u.user_id::text = x.actor_id;
  else
    v_source := 'sessions';
    select count(*), min(s.created_at), max(s.created_at)
      into v_total, v_first, v_last
    from auth.sessions s
    where v_scope = 'all' or s.user_id = v_uid;
    select coalesce(jsonb_agg(jsonb_build_object(
      'occurred_at', x.created_at,
      'action', 'Session started',
      'actor_profile_id', u.id,
      'actor_name', concat_ws(' ', u.surname || ',', u.first_name,
                              u.middle_initial, u.suffix),
      'actor_role', u.role,
      'detail', x.user_agent)
      order by x.created_at desc), '[]'::jsonb)
    into v_rows
    from (
      select s.created_at, s.user_id, s.user_agent
      from auth.sessions s
      where v_scope = 'all' or s.user_id = v_uid
      order by s.created_at desc
      limit v_limit
    ) x
    left join public."usersData" u on u.user_id = x.user_id;
  end if;

  return jsonb_build_object(
    'source', v_source,
    'scope', v_scope,
    'rows', v_rows,
    'total', coalesce(v_total, 0),
    'coverage_first', v_first,
    'coverage_last', v_last,
    'note', case
      when v_source = 'audit'
        then 'From the Supabase auth audit log (logins and logouts).'
      else 'From session records only — sign-outs and denied attempts appear once "Write audit logs to the database" is enabled in the Supabase dashboard.'
    end);
end $$;
revoke all on function public.lirc_sign_in_activity(text, integer)
  from public, anon;
grant execute on function public.lirc_sign_in_activity(text, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Review queue (items awaiting the caller's review)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_goal_review_queue(
  p_page integer default 1,
  p_page_size integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me bigint := lirc_private.my_profile_id();
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_limit integer := least(greatest(coalesce(p_page_size, 20), 1), 100);
  v_total bigint;
  v_rows jsonb;
begin
  if v_me is null then
    raise exception 'No library profile for this account.' using errcode = '42501';
  end if;
  if not (lirc_private.can_edit_catalog() or lirc_private.is_admin()) then
    raise exception 'Librarian or admin access required.' using errcode = '42501';
  end if;

  with base as (
    select i.id, i.goal_id, i.item_type, i.item_id, i.snapshot,
           g.name as goal_name, g.goal_type,
           coalesce(g.policy ->> 'review_requirement', 'none') as requirement,
           lirc_private.goal_review_count(i.id) as reviews
    from public.goal_items i
    join public.work_goals g on g.id = i.goal_id
    where g.status = 'active'
      and i.state = 'open'
      and coalesce(g.policy ->> 'review_requirement', 'none') <> 'none'
      and (lirc_private.is_admin()
           or not exists (
             select 1 from public.goal_members m
             where m.goal_id = g.id and m.role = 'reviewer')
           or lirc_private.is_goal_member(g.id, array['reviewer']))
      and not exists (
        select 1 from public.goal_contributions c
        where c.goal_item_id = i.id and c.kind = 'review'
          and c.status = 'awarded'
          and c.contributor_profile_id = v_me)
  ),
  candidates as (
    select base.*, count(*) over () as total_all
    from base
    where base.reviews <
          (case base.requirement when 'two_person' then 2 else 1 end)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'goal_item_id', y.id,
    'goal_id', y.goal_id,
    'goal_name', y.goal_name,
    'goal_type', y.goal_type,
    'item_type', y.item_type,
    'item_id', y.item_id,
    'snapshot', y.snapshot,
    'review_requirement', y.requirement,
    'reviews_accepted', y.reviews)
    order by y.id), '[]'::jsonb),
    coalesce(max(y.total_all), 0)
  into v_rows, v_total
  from (
    select * from candidates
    order by id
    limit v_limit
    offset (v_page - 1) * v_limit
  ) y;

  return jsonb_build_object(
    'rows', v_rows,
    'total', v_total,
    'has_next', (v_page * v_limit) < v_total);
end $$;
revoke all on function public.lirc_goal_review_queue(integer, integer)
  from public, anon;
grant execute on function public.lirc_goal_review_queue(integer, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 3. my_contribution gains p_kind ('work' | 'review')
-- ---------------------------------------------------------------------------
drop function if exists public.lirc_goal_my_contribution(bigint, integer, integer);

create or replace function public.lirc_goal_my_contribution(
  p_goal_id bigint,
  p_page integer default 1,
  p_page_size integer default 25,
  p_kind text default 'work')
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
  v_kind text := lower(btrim(coalesce(p_kind, 'work')));
  v_total bigint;
  v_rows jsonb;
begin
  if v_me is null then
    raise exception 'No library profile for this account.' using errcode = '42501';
  end if;
  if v_kind not in ('work', 'review') then
    raise exception 'Unknown contribution kind.';
  end if;
  if not (lirc_private.is_admin() or lirc_private.is_goal_member(p_goal_id)) then
    raise exception 'You are not a member of this goal.' using errcode = '42501';
  end if;
  v_page := greatest(coalesce(p_page, 1), 1);
  v_size := least(greatest(coalesce(p_page_size, 25), 1), 100);

  select count(*) into v_total
  from public.goal_contributions c
  where c.goal_id = p_goal_id and c.kind = v_kind
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
    where c.goal_id = p_goal_id and c.kind = v_kind
      and c.contributor_profile_id = v_me
      and c.reversal_of_id is null
    order by c.awarded_at desc, c.id desc
    limit v_size offset (v_page - 1) * v_size
  ) c
  join public.goal_items i on i.id = c.goal_item_id;

  return jsonb_build_object(
    'kind', v_kind,
    'rows', v_rows,
    'total', v_total,
    'has_next', (v_page * v_size) < v_total,
    'units', coalesce((select sum(c.units) from public.goal_contributions c
                        where c.goal_id = p_goal_id and c.kind = v_kind
                          and c.status = 'awarded'
                          and c.contributor_profile_id = v_me), 0),
    'items', (select count(*) from public.goal_contributions c
               where c.goal_id = p_goal_id and c.kind = v_kind
                 and c.status = 'awarded'
                 and c.contributor_profile_id = v_me));
end $$;
revoke all on function public.lirc_goal_my_contribution(bigint, integer, integer, text)
  from public, anon;
grant execute on function public.lirc_goal_my_contribution(bigint, integer, integer, text)
  to authenticated;

notify pgrst, 'reload schema';
commit;
