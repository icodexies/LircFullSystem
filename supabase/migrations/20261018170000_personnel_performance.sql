-- ============================================================================
-- User performance (admin only): summarized statistics per library person.
--
-- 1. lirc_private.activity_summary_for(profile, days) — the same aggregation
--    the personal dashboard uses, now parameterized.
-- 2. lirc_activity_my_summary keeps its signature and calls the helper.
-- 3. lirc_personnel_performance_people() — the people list (librarian, staff,
--    admin) for the admin page.
-- 4. lirc_personnel_performance(profile, days) — one person's summary plus
--    their profile line and last recorded action.
-- ============================================================================
begin;

create or replace function lirc_private.activity_summary_for(
  p_profile bigint, p_days integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
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
  select count(*) into v_total
  from public.activity_events e
  where e.actor_profile_id = p_profile
    and e.occurred_at >= v_from;

  -- daily counts for the window, zero days included
  with counts as (
    select (e.occurred_at at time zone 'Asia/Manila')::date as day,
           count(*) as n
    from public.activity_events e
    where e.actor_profile_id = p_profile
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
    where e.actor_profile_id = p_profile
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
    where e.actor_profile_id = p_profile
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
  where e.actor_profile_id = p_profile
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
revoke all on function lirc_private.activity_summary_for(bigint, integer)
  from public, anon, authenticated;

-- The personal dashboard keeps its exact signature and numbers.
create or replace function public.lirc_activity_my_summary(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me bigint := lirc_private.my_profile_id();
begin
  if v_me is null then
    raise exception 'No library profile for this account.' using errcode = '42501';
  end if;
  return lirc_private.activity_summary_for(v_me, p_days);
end $$;
revoke all on function public.lirc_activity_my_summary(integer)
  from public, anon;
grant execute on function public.lirc_activity_my_summary(integer)
  to authenticated;

-- People list for the admin page: librarians, staff and admins.
create or replace function public.lirc_personnel_performance_people()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rows jsonb;
begin
  if not lirc_private.is_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', u.id,
           'full_name', concat_ws(' ', u.first_name, u.middle_initial, u.surname, u.suffix),
           'role', u.role,
           'library_id', u.library_id)
         order by case lower(btrim(u.role::text))
                    when 'librarian' then 1
                    when 'staff' then 2
                    else 3
                  end,
                  u.surname, u.first_name, u.id), '[]'::jsonb)
    into v_rows
  from public."usersData" u
  where lower(btrim(u.role::text)) in ('librarian', 'staff', 'admin');
  return v_rows;
end $$;
revoke all on function public.lirc_personnel_performance_people()
  from public, anon;
grant execute on function public.lirc_personnel_performance_people()
  to authenticated;

-- One person's summarized statistics (admin only).
create or replace function public.lirc_personnel_performance(
  p_profile_id bigint, p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  u public."usersData"%ROWTYPE;
  v_last timestamptz;
begin
  if not lirc_private.is_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  select * into u from public."usersData" where id = p_profile_id;
  if not found then
    raise exception 'Person not found.';
  end if;
  if lower(btrim(u.role::text)) not in ('librarian', 'staff', 'admin') then
    raise exception 'Not a library personnel record.';
  end if;
  select max(e.occurred_at) into v_last
  from public.activity_events e
  where e.actor_profile_id = u.id;
  return jsonb_build_object(
    'profile', jsonb_build_object(
      'id', u.id,
      'full_name', concat_ws(' ', u.first_name, u.middle_initial, u.surname, u.suffix),
      'role', u.role,
      'library_id', u.library_id),
    'last_active_at', v_last,
    'summary', lirc_private.activity_summary_for(u.id, p_days));
end $$;
revoke all on function public.lirc_personnel_performance(bigint, integer)
  from public, anon;
grant execute on function public.lirc_personnel_performance(bigint, integer)
  to authenticated;

notify pgrst, 'reload schema';
commit;
