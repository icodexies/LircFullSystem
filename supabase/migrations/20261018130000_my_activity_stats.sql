-- ============================================================================
-- Personal activity statistics for the dashboard charts.
--
-- lirc_activity_my_summary now returns the full chart payload (same
-- signature): daily counts for the window (Philippine-time days, zero days
-- filled), per-kind group counts (the same families as the User logs chips
-- plus "other"), active days, current streak and the busiest day — all
-- computed here, never in the browser.
-- ============================================================================
begin;

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
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_start date := v_today - (v_days - 1);
  v_from timestamptz := (v_start::timestamp at time zone 'Asia/Manila');
  v_total bigint;
  v_active integer;
  v_streak integer := 0;
  v_expect date := v_today;
  v_first boolean := true;
  v_busiest_day date;
  v_busiest_count bigint;
  v_daily jsonb;
  v_groups jsonb;
  v_g1 bigint;
  v_g2 bigint;
  v_g3 bigint;
  v_g4 bigint;
  v_g5 bigint;
  v_g6 bigint;
  v_g7 bigint;
  v_g8 bigint;
  v_g9 bigint;
  v_other bigint;
  r record;
begin
  if v_me is null then
    raise exception 'No library profile for this account.' using errcode = '42501';
  end if;

  select count(*) into v_total
  from public.activity_events e
  where e.actor_profile_id = v_me
    and e.occurred_at >= v_from;

  -- daily counts for the window, zero days included
  with counts as (
    select (e.occurred_at at time zone 'Asia/Manila')::date as day,
           count(*) as n
    from public.activity_events e
    where e.actor_profile_id = v_me
      and e.occurred_at >= v_from
    group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'day', g.d::date,
           'count', coalesce(c.n, 0))
           order by g.d), '[]'::jsonb),
         count(*) filter (where coalesce(c.n, 0) > 0)
    into v_daily, v_active
  from generate_series(v_start::timestamp, v_today::timestamp,
                       interval '1 day') as g(d)
  left join counts c on c.day = g.d::date;

  -- busiest day in the window
  select c.day, c.n into v_busiest_day, v_busiest_count
  from (
    select (e.occurred_at at time zone 'Asia/Manila')::date as day,
           count(*) as n
    from public.activity_events e
    where e.actor_profile_id = v_me
      and e.occurred_at >= v_from
    group by 1
  ) c
  order by c.n desc, c.day desc
  limit 1;

  -- streak: consecutive days with activity, walking back from today
  -- (an empty today does not break yesterday's streak)
  for r in
    select (e.occurred_at at time zone 'Asia/Manila')::date as day,
           count(*) as n
    from public.activity_events e
    where e.actor_profile_id = v_me
      and e.occurred_at >= v_from
    group by 1
    order by 1 desc
  loop
    if r.day = v_expect then
      v_streak := v_streak + 1;
      v_expect := v_expect - 1;
      v_first := false;
    elsif v_first and r.day = v_today - 1 then
      v_streak := 1;
      v_expect := r.day - 1;
      v_first := false;
    else
      exit;
    end if;
  end loop;

  -- per-kind groups (same families as the filter chips; "other" is the rest)
  select count(*) filter (where e.action like 'inventory.%'),
         count(*) filter (where e.action like 'loans.%'
                            or e.action like 'book_loans.%'),
         count(*) filter (where e.action like 'users.%'
                            or e.action like 'usersData.%'),
         count(*) filter (where e.action like 'member_change.%'),
         count(*) filter (where e.action like 'enrollment.%'
                            or e.action like 'student_enrollments.%'),
         count(*) filter (where e.action like 'catalog.%'
                            or e.action like 'books.%'
                            or e.action like 'book_accession_numbers.%'),
         count(*) filter (where e.action like 'attendance.%'),
         count(*) filter (where e.action like 'semesters.%'
                            or e.action like 'academic_years.%'),
         count(*) filter (where e.action like 'barcode.%'
                            or e.action like 'barcode_entries.%'
                            or e.action like 'barcode_templates.%')
    into v_g1, v_g2, v_g3, v_g4, v_g5, v_g6, v_g7, v_g8, v_g9
  from public.activity_events e
  where e.actor_profile_id = v_me
    and e.occurred_at >= v_from;
  v_other := v_total - (v_g1 + v_g2 + v_g3 + v_g4 + v_g5 + v_g6 + v_g7 + v_g8 + v_g9);
  v_groups := jsonb_build_array(
    jsonb_build_object('key', 'inventory', 'count', v_g1),
    jsonb_build_object('key', 'loans', 'count', v_g2),
    jsonb_build_object('key', 'users', 'count', v_g3),
    jsonb_build_object('key', 'member_change', 'count', v_g4),
    jsonb_build_object('key', 'enrollment', 'count', v_g5),
    jsonb_build_object('key', 'catalog', 'count', v_g6),
    jsonb_build_object('key', 'attendance', 'count', v_g7),
    jsonb_build_object('key', 'semesters', 'count', v_g8),
    jsonb_build_object('key', 'barcode', 'count', v_g9),
    jsonb_build_object('key', 'other', 'count', greatest(v_other, 0)));

  return jsonb_build_object(
    'days', v_days,
    'total', v_total,
    'active_days', v_active,
    'streak', v_streak,
    'busiest_day', v_busiest_day,
    'busiest_count', v_busiest_count,
    'groups', v_groups,
    'daily', v_daily);
end $$;
revoke all on function public.lirc_activity_my_summary(integer)
  from public, anon;
grant execute on function public.lirc_activity_my_summary(integer)
  to authenticated;

notify pgrst, 'reload schema';
commit;
