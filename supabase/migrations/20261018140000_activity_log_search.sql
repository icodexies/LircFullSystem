-- ============================================================================
-- User logs: person search + date/time range filters.
--
-- lirc_activity_log_page gains `actor_search`:
--   * every typed word must appear in the actor's name (any order), and
--   * close spellings are matched too (trigram word_similarity > 0.6 —
--     the same rule as the member lookup).
-- Date/time filters (`from_occurred_at` / `to_occurred_at`) already existed;
-- they are now used by the page UI (Manila-time inputs).
-- ============================================================================
begin;

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
  v_actor_search text := nullif(btrim(coalesce(p_filters ->> 'actor_search', '')), '');
  v_words text[];
  v_from timestamptz := nullif(p_filters ->> 'from_occurred_at', '')::timestamptz;
  v_to timestamptz := nullif(p_filters ->> 'to_occurred_at', '')::timestamptz;
  v_total bigint;
  v_rows jsonb;
begin
  if not lirc_private.is_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  if v_actor_search is not null then
    if char_length(v_actor_search) > 120 then
      v_actor_search := left(v_actor_search, 120);
    end if;
    v_words := regexp_split_to_array(lower(v_actor_search), '\s+');
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
    and (v_to is null or e.occurred_at < v_to)
    and (v_actor_search is null or exists (
      select 1
      from public."usersData" u
      where u.id = e.actor_profile_id
        and (
          not exists (
            select 1 from unnest(v_words) as w
            where w <> ''
              and concat_ws(' ', u.first_name, u.middle_initial,
                            u.surname, u.suffix) not ilike '%' || w || '%')
          or extensions.word_similarity(
               lower(v_actor_search),
               lower(concat_ws(' ', u.first_name, u.middle_initial,
                               u.surname, u.suffix))) > 0.6)));

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
      and (v_actor_search is null or exists (
        select 1
        from public."usersData" u
        where u.id = e.actor_profile_id
          and (
            not exists (
              select 1 from unnest(v_words) as w
              where w <> ''
                and concat_ws(' ', u.first_name, u.middle_initial,
                              u.surname, u.suffix) not ilike '%' || w || '%')
            or extensions.word_similarity(
                 lower(v_actor_search),
                 lower(concat_ws(' ', u.first_name, u.middle_initial,
                                 u.surname, u.suffix))) > 0.6)))
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
