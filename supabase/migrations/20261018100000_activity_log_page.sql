-- ============================================================================
-- Activity log page (admin) + personal activity summary
--
--   * lirc_activity_log_page — EVERY recorded action (all people, all roles)
--     with numbered pagination and filters. Admin only.
--   * lirc_activity_my_summary — counts for the caller's dashboard cards
--     (last N days, grouped by kind of work). Admins also get the everyone
--     total so the dashboard can link to the full log.
--
-- The goal tables stay untouched (parked for the future redesign); nothing
-- is deleted.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. Full activity log (admin), numbered pages
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 2. Personal activity summary (dashboard cards)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_activity_my_summary(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me bigint := lirc_private.my_profile_id();
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 365);
  v_from timestamptz := now() - make_interval(days => least(greatest(coalesce(p_days, 30), 1), 365));
  v_total bigint;
  v_inventory bigint;
  v_loans bigint;
  v_catalog bigint;
  v_members bigint;
  v_attendance bigint;
  v_barcode bigint;
  v_goals bigint;
  v_all_total bigint;
begin
  if v_me is null then
    raise exception 'No library profile for this account.' using errcode = '42501';
  end if;

  select count(*),
         count(*) filter (where e.action like 'inventory.%'),
         count(*) filter (where e.action like 'loans.%'),
         count(*) filter (where e.action like 'catalog.%'
                            or e.action like 'books.%'
                            or e.action like 'book_accession_numbers.%'),
         count(*) filter (where e.action like 'users.%'
                            or e.action like 'usersData.%'
                            or e.action like 'member_change.%'
                            or e.action like 'enrollment.%'
                            or e.action like 'student_enrollments.%'),
         count(*) filter (where e.action like 'attendance.%'),
         count(*) filter (where e.action like 'barcode.%'),
         count(*) filter (where e.action like 'goal.%')
    into v_total, v_inventory, v_loans, v_catalog, v_members,
         v_attendance, v_barcode, v_goals
  from public.activity_events e
  where e.actor_profile_id = v_me
    and e.occurred_at >= v_from;

  if lirc_private.is_admin() then
    select count(*) into v_all_total
    from public.activity_events e
    where e.occurred_at >= v_from;
  end if;

  return jsonb_build_object(
    'days', v_days,
    'total', v_total,
    'inventory', v_inventory,
    'loans', v_loans,
    'catalog', v_catalog,
    'members', v_members,
    'attendance', v_attendance,
    'barcode', v_barcode,
    'goals', v_goals,
    'all_total', v_all_total);
end $$;
revoke all on function public.lirc_activity_my_summary(integer)
  from public, anon;
grant execute on function public.lirc_activity_my_summary(integer)
  to authenticated;

notify pgrst, 'reload schema';
commit;
