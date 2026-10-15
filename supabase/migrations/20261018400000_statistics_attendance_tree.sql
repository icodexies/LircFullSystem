-- ============================================================================
-- Attendance statistics, organized like the report: visits by department →
-- program → year level (the year level saved at visit, students only), each
-- level carrying its visits, unique visitors, average stay and its five most
-- frequent visitors — so the page lists compact clickable rows and opens a
-- modal per group instead of one overwhelming page.
--
-- Also adds lirc_statistics_borrower: one member's borrowing record for the
-- semester — their frequency, the books they borrowed (with counts) and
-- their recent loans — for the "Most active borrowers" modal.
--
-- Everything else in lirc_statistics_attendance is unchanged.
-- ============================================================================
begin;

create or replace function public.lirc_statistics_attendance(
  p_semester_id bigint default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sem public.semesters%ROWTYPE;
  v_start timestamptz;
  v_end timestamptz;
  v_monthly jsonb;
  v_by_hour jsonb;
  v_visits_tree jsonb;
begin
  if lirc_private.library_operator_id() is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  if p_semester_id is not null then
    select * into v_sem from public.semesters where id = p_semester_id;
  end if;
  if v_sem.id is null then
    select * into v_sem from public.semesters where is_active limit 1;
  end if;
  if v_sem.id is not null then
    v_start := v_sem.starts_on::timestamp at time zone 'Asia/Manila';
    v_end := (v_sem.ends_on + 1)::timestamp at time zone 'Asia/Manila';
  end if;

  with months as (
    select m.start_at
    from generate_series(
      date_trunc('month', v_sem.starts_on::timestamp),
      date_trunc('month', v_sem.ends_on::timestamp),
      interval '1 month') as m(start_at)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'month', to_char(m.start_at, 'YYYY-MM'),
      'visits', (
        select count(*) from public.attendance a
        where v_start is not null
          and (a.time_in at time zone 'Asia/Manila') >= m.start_at
          and (a.time_in at time zone 'Asia/Manila') < m.start_at + interval '1 month'),
      'unique_visitors', (
        select count(distinct a.user_profile_id) from public.attendance a
        where v_start is not null
          and (a.time_in at time zone 'Asia/Manila') >= m.start_at
          and (a.time_in at time zone 'Asia/Manila') < m.start_at + interval '1 month')
    ) order by m.start_at), '[]'::jsonb)
  into v_monthly
  from months m;

  select coalesce(jsonb_agg(jsonb_build_object(
      'hour', h.hour, 'visits', coalesce(v.n, 0)) order by h.hour), '[]'::jsonb)
  into v_by_hour
  from generate_series(6, 21) as h(hour)
  left join (
    select extract(hour from (a.time_in at time zone 'Asia/Manila'))::int as hour,
           count(*) as n
    from public.attendance a
    where v_start is not null
      and a.time_in >= v_start and a.time_in < v_end
    group by 1) v on v.hour = h.hour;

  -- The visits tree: department → program → year level (at visit).
  with visit_rows as (
    select coalesce(d.name, '(No department)') as department,
           coalesce(prog.name, '(No program)') as program,
           case when lower(btrim(a.role_at_visit)) = 'student'
                then a.year_level end as year_level,
           a.user_profile_id,
           case when a.time_out is not null
                then extract(epoch from (a.time_out - a.time_in)) / 60
                end as minutes
    from public.attendance a
    join public."usersData" u on u.id = a.user_profile_id
    left join public.departments d on d.id = u.department_id
    left join public.programs prog on prog.id = u.program_id
    where v_start is not null
      and a.time_in >= v_start and a.time_in < v_end
  ),
  dept_stats as (
    select department as label, count(*) as visits,
           count(distinct user_profile_id) as unique_visitors,
           round(avg(minutes)::numeric, 1) as avg_minutes
    from visit_rows
    group by department
  ),
  prog_stats as (
    select department, program as label, count(*) as visits,
           count(distinct user_profile_id) as unique_visitors,
           round(avg(minutes)::numeric, 1) as avg_minutes
    from visit_rows
    group by department, program
  ),
  year_stats as (
    select department, program, year_level::text as label, count(*) as visits,
           count(distinct user_profile_id) as unique_visitors,
           round(avg(minutes)::numeric, 1) as avg_minutes
    from visit_rows
    where year_level is not null
    group by department, program, year_level
  ),
  dept_vis as (
    select department, jsonb_agg(jsonb_build_object(
        'id', x.id, 'name', x.name, 'library_id', x.library_id,
        'role', x.role, 'count', x.n) order by x.n desc, x.name) as visitors
    from (
      select vr.department, u.id,
             concat_ws(' ', u.first_name, u.middle_initial,
                       u.surname, u.suffix) as name,
             u.library_id, lower(btrim(u.role::text)) as role,
             count(*) as n,
             row_number() over (partition by vr.department
                                order by count(*) desc,
                                         u.surname, u.first_name) as rn
      from visit_rows vr
      join public."usersData" u on u.id = vr.user_profile_id
      group by vr.department, u.id
    ) x
    where x.rn <= 5
    group by department
  ),
  prog_vis as (
    select department, program, jsonb_agg(jsonb_build_object(
        'id', x.id, 'name', x.name, 'library_id', x.library_id,
        'role', x.role, 'count', x.n) order by x.n desc, x.name) as visitors
    from (
      select vr.department, vr.program, u.id,
             concat_ws(' ', u.first_name, u.middle_initial,
                       u.surname, u.suffix) as name,
             u.library_id, lower(btrim(u.role::text)) as role,
             count(*) as n,
             row_number() over (partition by vr.department, vr.program
                                order by count(*) desc,
                                         u.surname, u.first_name) as rn
      from visit_rows vr
      join public."usersData" u on u.id = vr.user_profile_id
      group by vr.department, vr.program, u.id
    ) x
    where x.rn <= 5
    group by department, program
  ),
  year_vis as (
    select department, program, year_level::text as label,
           jsonb_agg(jsonb_build_object(
        'id', x.id, 'name', x.name, 'library_id', x.library_id,
        'role', x.role, 'count', x.n) order by x.n desc, x.name) as visitors
    from (
      select vr.department, vr.program, vr.year_level, u.id,
             concat_ws(' ', u.first_name, u.middle_initial,
                       u.surname, u.suffix) as name,
             u.library_id, lower(btrim(u.role::text)) as role,
             count(*) as n,
             row_number() over (partition by vr.department, vr.program, vr.year_level
                                order by count(*) desc,
                                         u.surname, u.first_name) as rn
      from visit_rows vr
      join public."usersData" u on u.id = vr.user_profile_id
      where vr.year_level is not null
      group by vr.department, vr.program, vr.year_level, u.id
    ) x
    where x.rn <= 5
    group by department, program, year_level
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'label', s.label,
      'visits', s.visits,
      'unique', s.unique_visitors,
      'avg_minutes', s.avg_minutes,
      'visitors', coalesce(dv.visitors, '[]'::jsonb),
      'programs', coalesce((
        select jsonb_agg(jsonb_build_object(
            'label', ps.label,
            'visits', ps.visits,
            'unique', ps.unique_visitors,
            'avg_minutes', ps.avg_minutes,
            'visitors', coalesce(pv.visitors, '[]'::jsonb),
            'years', coalesce((
              select jsonb_agg(jsonb_build_object(
                  'label', ys.label,
                  'visits', ys.visits,
                  'unique', ys.unique_visitors,
                  'avg_minutes', ys.avg_minutes,
                  'visitors', coalesce(yv.visitors, '[]'::jsonb))
                  order by ys.label)
              from year_stats ys
              left join year_vis yv
                on yv.department = ys.department
               and yv.program = ys.program
               and yv.label = ys.label
              where ys.department = ps.department
                and ys.program = ps.label), '[]'::jsonb))
          order by ps.visits desc, ps.label)
        from prog_stats ps
        left join prog_vis pv
          on pv.department = ps.department and pv.program = ps.label
        where ps.department = s.label), '[]'::jsonb))
    order by s.visits desc, s.label), '[]'::jsonb)
  into v_visits_tree
  from dept_stats s
  left join dept_vis dv on dv.department = s.label;

  return jsonb_build_object(
    'semester', jsonb_build_object(
      'id', v_sem.id,
      'name', v_sem.name,
      'year', (select ay.name from public.academic_years ay
               where ay.id = v_sem.academic_year_id)),
    'monthly', v_monthly,
    'by_hour', v_by_hour,
    'visits_tree', v_visits_tree,
    'totals', jsonb_build_object(
      'visits', (
        select count(*) from public.attendance a
        where v_start is not null
          and a.time_in >= v_start and a.time_in < v_end),
      'unique_visitors', (
        select count(distinct a.user_profile_id) from public.attendance a
        where v_start is not null
          and a.time_in >= v_start and a.time_in < v_end),
      'inside', (
        select count(*) from public.attendance a
        where v_start is not null
          and a.time_in >= v_start and a.time_in < v_end
          and a.time_out is null),
      'avg_minutes', (
        select round(avg(extract(epoch from (a.time_out - a.time_in)) / 60)::numeric, 1)
        from public.attendance a
        where v_start is not null
          and a.time_in >= v_start and a.time_in < v_end
          and a.time_out is not null),
      'busiest_day', (
        select jsonb_build_object('date', x.day, 'visits', x.n)
        from (
          select (a.time_in at time zone 'Asia/Manila')::date as day, count(*) as n
          from public.attendance a
          where v_start is not null
            and a.time_in >= v_start and a.time_in < v_end
          group by 1
          order by n desc, day
          limit 1) x)),
    'by_role', (
      select coalesce(jsonb_agg(jsonb_build_object('label', x.role, 'count', x.n)
                                order by x.n desc, x.role), '[]'::jsonb)
      from (
        select lower(btrim(a.role_at_visit)) as role, count(*) as n
        from public.attendance a
        where v_start is not null
          and a.time_in >= v_start and a.time_in < v_end
        group by 1) x),
    'by_purpose', (
      select coalesce(jsonb_agg(jsonb_build_object('label', x.purpose, 'count', x.n)
                                order by x.n desc, x.purpose), '[]'::jsonb)
      from (
        select a.purpose_of_visit as purpose, count(*) as n
        from public.attendance a
        where v_start is not null
          and a.time_in >= v_start and a.time_in < v_end
        group by 1) x),
    'by_department', (
      select coalesce(jsonb_agg(jsonb_build_object('label', x.label, 'count', x.n)
                                order by x.n desc, x.label), '[]'::jsonb)
      from (
        select coalesce(d.name, '(No department)') as label, count(*) as n
        from public.attendance a
        join public."usersData" u on u.id = a.user_profile_id
        left join public.departments d on d.id = u.department_id
        where v_start is not null
          and a.time_in >= v_start and a.time_in < v_end
        group by 1
        order by n desc, label
        limit 10) x),
    'top_visitors', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', x.id,
          'name', concat_ws(' ', x.first_name, x.middle_initial,
                            x.surname, x.suffix),
          'library_id', x.library_id,
          'role', lower(btrim(x.role::text)),
          'count', x.n) order by x.n desc, x.surname, x.first_name), '[]'::jsonb)
      from (
        select u.id, u.first_name, u.middle_initial, u.surname, u.suffix,
               u.library_id, u.role, count(*) as n
        from public.attendance a
        join public."usersData" u on u.id = a.user_profile_id
        where v_start is not null
          and a.time_in >= v_start and a.time_in < v_end
        group by u.id
        order by count(*) desc, u.surname, u.first_name
        limit 10) x));
end $$;
revoke all on function public.lirc_statistics_attendance(bigint) from public, anon;
grant execute on function public.lirc_statistics_attendance(bigint) to authenticated;

create or replace function public.lirc_statistics_borrower(
  p_profile_id bigint,
  p_semester_id bigint default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sem public.semesters%ROWTYPE;
  v_start timestamptz;
  v_end timestamptz;
  u public."usersData"%ROWTYPE;
begin
  if lirc_private.library_operator_id() is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  if p_profile_id is null then
    raise exception 'A library member is required.';
  end if;
  select * into u from public."usersData" where id = p_profile_id;
  if not found then
    raise exception 'Library member not found.';
  end if;
  if p_semester_id is not null then
    select * into v_sem from public.semesters where id = p_semester_id;
  end if;
  if v_sem.id is null then
    select * into v_sem from public.semesters where is_active limit 1;
  end if;
  if v_sem.id is not null then
    v_start := v_sem.starts_on::timestamp at time zone 'Asia/Manila';
    v_end := (v_sem.ends_on + 1)::timestamp at time zone 'Asia/Manila';
  end if;

  return jsonb_build_object(
    'profile', jsonb_build_object(
      'id', u.id,
      'name', concat_ws(' ', u.first_name, u.middle_initial,
                        u.surname, u.suffix),
      'library_id', u.library_id,
      'role', lower(btrim(u.role::text)),
      'avatar_url', u.avatar_url),
    'totals', jsonb_build_object(
      'loans', (
        select count(*) from public.book_loans l
        where l.user_profile_id = u.id
          and v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end),
      'open', (
        select count(*) from public.book_loans l
        where l.user_profile_id = u.id
          and v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end
          and l.returned_at is null),
      'overdue', (
        select count(*) from public.book_loans l
        where l.user_profile_id = u.id
          and v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end
          and l.returned_at is null and l.due_at < now()),
      'returned', (
        select count(*) from public.book_loans l
        where l.user_profile_id = u.id
          and v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end
          and l.returned_at is not null),
      'on_time', (
        select count(*) from public.book_loans l
        where l.user_profile_id = u.id
          and v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end
          and l.returned_at is not null and l.returned_at <= l.due_at),
      'late', (
        select count(*) from public.book_loans l
        where l.user_profile_id = u.id
          and v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end
          and l.returned_at is not null and l.returned_at > l.due_at),
      'avg_days', (
        select round(avg(extract(epoch from (l.returned_at - l.borrowed_at))
                         / 86400)::numeric, 1)
        from public.book_loans l
        where l.user_profile_id = u.id
          and v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end
          and l.returned_at is not null)),
    'books', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', x.book_id, 'name', x.book_name, 'count', x.n)
          order by x.n desc, x.book_name), '[]'::jsonb)
      from (
        select b.id as book_id, b.book_name, count(*) as n
        from public.book_loans l
        join public.book_accession_numbers a on a.id = l.accession_id
        join public.books b on b.id = a.book_id
        where l.user_profile_id = u.id
          and v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end
        group by b.id, b.book_name
        order by count(*) desc, b.book_name
        limit 10) x),
    'loans', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', x.id,
          'book_id', x.book_id,
          'book_name', x.book_name,
          'accession_number', x.accession_number,
          'borrowed_at', x.borrowed_at,
          'due_at', x.due_at,
          'returned_at', x.returned_at,
          'is_overdue', x.is_overdue)
          order by x.borrowed_at desc, x.id desc), '[]'::jsonb)
      from (
        select l.id, b.id as book_id, b.book_name, a.accession_number,
               l.borrowed_at, l.due_at, l.returned_at,
               (l.returned_at is null and l.due_at < now()) as is_overdue
        from public.book_loans l
        join public.book_accession_numbers a on a.id = l.accession_id
        join public.books b on b.id = a.book_id
        where l.user_profile_id = u.id
          and v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end
        order by l.borrowed_at desc, l.id desc
        limit 10) x));
end $$;
revoke all on function public.lirc_statistics_borrower(bigint, bigint)
  from public, anon;
grant execute on function public.lirc_statistics_borrower(bigint, bigint)
  to authenticated;

notify pgrst, 'reload schema';
commit;
