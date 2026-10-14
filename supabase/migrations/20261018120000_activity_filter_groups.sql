-- ============================================================================
-- Activity filters: a chip can now match several action families.
--
-- "Members" must cover users.add / users.import AND direct usersData edits;
-- "Catalog" must cover catalog.*, books.* and book_accession_numbers.*;
-- and so on. Both read RPCs accept the new `action_prefixes` filter (array)
-- alongside the old single `action_prefix`.
-- ============================================================================
begin;

create or replace function public.lirc_activity_feed(
  p_scope text default 'own',
  p_filters jsonb default '{}'::jsonb,
  p_before_occurred_at timestamptz default null,
  p_before_id bigint default null,
  p_page_size integer default 25)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me bigint := lirc_private.my_profile_id();
  v_scope text := coalesce(lower(btrim(coalesce(p_scope, 'own'))), 'own');
  v_limit integer := least(greatest(coalesce(p_page_size, 25), 1), 100);
  v_rows jsonb;
  v_has_more boolean := false;
  v_next_time timestamptz;
  v_next_id bigint;
  v_action text;
  v_prefix text;
  v_prefixes text[];
  v_entity_type text;
  v_entity_id bigint;
  v_source text;
  v_from timestamptz;
  v_to timestamptz;
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

  v_action := nullif(p_filters ->> 'action', '');
  v_prefix := nullif(p_filters ->> 'action_prefix', '');
  v_prefixes := case
    when jsonb_typeof(p_filters -> 'action_prefixes') = 'array'
      then (select array_agg(value || '%')
              from jsonb_array_elements_text(p_filters -> 'action_prefixes'))
    else null end;
  v_entity_type := nullif(p_filters ->> 'entity_type', '');
  v_entity_id := nullif(p_filters ->> 'entity_id', '')::bigint;
  v_source := nullif(p_filters ->> 'source', '');
  v_from := nullif(p_filters ->> 'from_occurred_at', '')::timestamptz;
  v_to := nullif(p_filters ->> 'to_occurred_at', '')::timestamptz;

  with base as (
    select e.*
    from public.activity_events e
    where (v_scope = 'all' or e.actor_profile_id = v_me)
      and (v_action is null or e.action = v_action)
      and (v_prefix is null or e.action like v_prefix || '%')
      and (v_prefixes is null or e.action like any (v_prefixes))
      and (v_entity_type is null or e.entity_type = v_entity_type)
      and (v_entity_id is null or e.entity_id = v_entity_id)
      and (v_source is null or e.source = v_source)
      and (v_from is null or e.occurred_at >= v_from)
      and (v_to is null or e.occurred_at < v_to)
      and (p_before_occurred_at is null
           or (e.occurred_at, e.id) < (p_before_occurred_at, coalesce(p_before_id, 0)))
    order by e.occurred_at desc, e.id desc
    limit v_limit + 1
  ),
  page as (
    select * from base order by occurred_at desc, id desc limit v_limit
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'occurred_at', p.occurred_at,
      'action', p.action,
      'source', p.source,
      'actor_kind', p.actor_kind,
      'actor_profile_id', p.actor_profile_id,
      'actor_name', concat_ws(' ', u.first_name, u.middle_initial, u.surname, u.suffix),
      'actor_role', p.actor_role,
      'entity_type', p.entity_type,
      'entity_id', p.entity_id,
      'operation_id', p.operation_id,
      'parent_type', p.parent_type,
      'parent_id', p.parent_id,
      'changes', p.changes,
      'reason', p.reason,
      'description', lirc_private.describe_activity(p))
      order by p.occurred_at desc, p.id desc), '[]'::jsonb),
    (select count(*) from base) > (select count(*) from page),
    (select p.occurred_at from page p order by p.occurred_at asc, p.id asc limit 1),
    (select p.id from page p order by p.occurred_at asc, p.id asc limit 1)
  into v_rows, v_has_more, v_next_time, v_next_id
  from page p
  left join public."usersData" u on u.id = p.actor_profile_id;

  return jsonb_build_object(
    'rows', v_rows,
    'has_more', coalesce(v_has_more, false),
    'next_before_occurred_at', case when v_has_more then v_next_time end,
    'next_before_id', case when v_has_more then v_next_id end);
end $$;
revoke all on function public.lirc_activity_feed(text, jsonb, timestamptz, bigint, integer)
  from public, anon;
grant execute on function public.lirc_activity_feed(text, jsonb, timestamptz, bigint, integer)
  to authenticated;

create or replace function public.lirc_activity_log_page(
  p_filters jsonb default '{}'::jsonb,
  p_page integer default 1,
  p_page_size integer default 25)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_size integer := least(greatest(coalesce(p_page_size, 25), 1), 100);
  v_prefix text := nullif(btrim(coalesce(p_filters ->> 'action_prefix', '')), '');
  v_prefixes text[] := case
    when jsonb_typeof(p_filters -> 'action_prefixes') = 'array'
      then (select array_agg(value || '%')
              from jsonb_array_elements_text(p_filters -> 'action_prefixes'))
    else null end;
  v_role text := nullif(btrim(coalesce(p_filters ->> 'actor_role', '')), '');
  v_source text := nullif(btrim(coalesce(p_filters ->> 'source', '')), '');
  v_from timestamptz := nullif(p_filters ->> 'from_occurred_at', '')::timestamptz;
  v_to timestamptz := nullif(p_filters ->> 'to_occurred_at', '')::timestamptz;
  v_total bigint;
  v_rows jsonb;
begin
  if not lirc_private.is_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;

  select count(*) into v_total
  from public.activity_events e
  where (v_prefix is null or e.action like v_prefix || '%')
    and (v_prefixes is null or e.action like any (v_prefixes))
    and (v_role is null
         or coalesce(
              (select u.role::text from public."usersData" u
                where u.id = e.actor_profile_id),
              e.actor_role) = v_role)
    and (v_source is null or e.source = v_source)
    and (v_from is null or e.occurred_at >= v_from)
    and (v_to is null or e.occurred_at < v_to);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', y.id,
    'occurred_at', y.occurred_at,
    'action', y.action,
    'source', y.source,
    'actor_kind', y.actor_kind,
    'actor_profile_id', y.actor_profile_id,
    'actor_name', (
      select concat_ws(' ', u.surname || ',', u.first_name,
                       u.middle_initial, u.suffix)
      from public."usersData" u where u.id = y.actor_profile_id),
    'actor_role', coalesce(
      (select u.role::text from public."usersData" u
        where u.id = y.actor_profile_id),
      y.actor_role),
    'entity_type', y.entity_type,
    'entity_id', y.entity_id,
    'operation_id', y.operation_id,
    'changes', y.changes,
    'reason', y.reason,
    'description', lirc_private.describe_activity(y))
    order by y.occurred_at desc, y.id desc), '[]'::jsonb)
  into v_rows
  from (
    select e.*
    from public.activity_events e
    where (v_prefix is null or e.action like v_prefix || '%')
      and (v_prefixes is null or e.action like any (v_prefixes))
      and (v_role is null
           or coalesce(
                (select u.role::text from public."usersData" u
                  where u.id = e.actor_profile_id),
                e.actor_role) = v_role)
      and (v_source is null or e.source = v_source)
      and (v_from is null or e.occurred_at >= v_from)
      and (v_to is null or e.occurred_at < v_to)
    order by e.occurred_at desc, e.id desc
    limit v_size offset (v_page - 1) * v_size
  ) y;

  return jsonb_build_object(
    'rows', v_rows,
    'total', v_total,
    'page', v_page,
    'page_size', v_size,
    'pages', greatest(ceil(v_total::numeric / v_size), 1),
    'has_prev', v_page > 1,
    'has_next', (v_page * v_size) < v_total);
end $$;
revoke all on function public.lirc_activity_log_page(jsonb, integer, integer)
  from public, anon;
grant execute on function public.lirc_activity_log_page(jsonb, integer, integer)
  to authenticated;

notify pgrst, 'reload schema';
commit;
