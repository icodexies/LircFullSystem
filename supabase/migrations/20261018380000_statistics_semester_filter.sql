-- ============================================================================
-- Statistics follow the header semester. Every statistics function gains
-- p_semester_id (default null → the globally active semester):
--
--   * lirc_statistics_overview(p_semester_id) — borrowing counts cover loans
--     that STARTED in that semester; attendance covers visits in it; members
--     gain the semester's active members (visited or borrowed) and the
--     profiles added during it; validation follows the semester's school year
--     (library validation is annual — both semesters of a year share it).
--   * lirc_statistics_borrowing(p_semester_id) — the monthly lines, totals,
--     rankings and the drill tree all cover the semester's loan cohort.
--   * lirc_statistics_attendance(p_semester_id) — the monthly lines, hours,
--     breakdowns and totals cover the semester's visits.
--
-- Semester dates are Manila dates: bounds are Manila midnights, the end
-- exclusive. Monthly buckets are the semester's own months.
-- ============================================================================
begin;

create or replace function public.lirc_statistics_overview(
  p_semester_id bigint default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sem public.semesters%ROWTYPE;
  v_year_name text;
  v_start timestamptz;
  v_end timestamptz;
begin
  if p_semester_id is not null then
    select * into v_sem from public.semesters where id = p_semester_id;
  end if;
  if v_sem.id is null then
    select * into v_sem from public.semesters where is_active limit 1;
  end if;
  if v_sem.id is not null then
    select ay.name into v_year_name
    from public.academic_years ay where ay.id = v_sem.academic_year_id;
    v_start := v_sem.starts_on::timestamp at time zone 'Asia/Manila';
    v_end := (v_sem.ends_on + 1)::timestamp at time zone 'Asia/Manila';
  end if;

  return jsonb_build_object(
    'catalog', jsonb_build_object(
      'titles', (select count(*) from public.books),
      'copies', (select count(*) from public.book_accession_numbers),
      'available', (
        select count(*)
        from public.book_accession_numbers a
        where (a.status is null
               or lower(btrim(a.status)) in ('', 'available'))
          and not exists (
            select 1 from public.book_loans l
            where l.accession_id = a.id and l.returned_at is null))),
    'borrowing', jsonb_build_object(
      'total', (
        select count(*) from public.book_loans l
        where v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end),
      'open', (
        select count(*) from public.book_loans l
        where v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end
          and l.returned_at is null),
      'overdue', (
        select count(*) from public.book_loans l
        where v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end
          and l.returned_at is null and l.due_at < now()),
      'returned', (
        select count(*) from public.book_loans l
        where v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end
          and l.returned_at is not null)),
    'members', jsonb_build_object(
      'total', (select count(*) from public."usersData"),
      'by_role', (
        select coalesce(jsonb_object_agg(x.role, x.n), '{}'::jsonb)
        from (
          select lower(btrim(role::text)) as role, count(*) as n
          from public."usersData"
          group by 1) x),
      'students', (
        select count(*) from public."usersData"
        where lower(btrim(role::text)) = 'student'),
      'active', (
        select count(distinct a.user_profile_id)
        from (
          select at.user_profile_id
          from public.attendance at
          where v_start is not null
            and at.time_in >= v_start and at.time_in < v_end
          union
          select l.user_profile_id
          from public.book_loans l
          where v_start is not null
            and l.borrowed_at >= v_start and l.borrowed_at < v_end) a),
      'active_by_role', (
        select coalesce(jsonb_agg(jsonb_build_object('label', x.role, 'count', x.n)
                                  order by x.n desc, x.role), '[]'::jsonb)
        from (
          select lower(btrim(u.role::text)) as role, count(*) as n
          from (
            select at.user_profile_id
            from public.attendance at
            where v_start is not null
              and at.time_in >= v_start and at.time_in < v_end
            union
            select l.user_profile_id
            from public.book_loans l
            where v_start is not null
              and l.borrowed_at >= v_start and l.borrowed_at < v_end) a
          join public."usersData" u on u.id = a.user_profile_id
          group by 1) x),
      'active_by_department', (
        select coalesce(jsonb_agg(jsonb_build_object('label', x.label, 'count', x.n)
                                  order by x.n desc, x.label), '[]'::jsonb)
        from (
          select coalesce(d.name, '(No department)') as label, count(*) as n
          from (
            select at.user_profile_id
            from public.attendance at
            where v_start is not null
              and at.time_in >= v_start and at.time_in < v_end
            union
            select l.user_profile_id
            from public.book_loans l
            where v_start is not null
              and l.borrowed_at >= v_start and l.borrowed_at < v_end) a
          join public."usersData" u on u.id = a.user_profile_id
          left join public.departments d on d.id = u.department_id
          group by 1
          order by n desc, label
          limit 10) x)),
    'validation', jsonb_build_object(
      'year_name', v_year_name,
      'records', (
        select count(*) from public.student_enrollments
        where academic_year_id = v_sem.academic_year_id),
      'validated', (
        select count(*) from public.student_enrollments
        where academic_year_id = v_sem.academic_year_id
          and status = 'enrolled'
          and validated_at is not null),
      'by_status', (
        select coalesce(jsonb_agg(jsonb_build_object('label', x.status, 'count', x.n)
                                  order by x.n desc, x.status), '[]'::jsonb)
        from (
          select e.status, count(*) as n
          from public.student_enrollments e
          where e.academic_year_id = v_sem.academic_year_id
          group by 1) x)),
    'attendance', jsonb_build_object(
      'semester_id', v_sem.id,
      'semester_name', v_sem.name,
      'semester_year', v_year_name,
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
          and a.time_out is null)));
end $$;
revoke all on function public.lirc_statistics_overview(bigint) from public, anon;
grant execute on function public.lirc_statistics_overview(bigint) to authenticated;

create or replace function public.lirc_statistics_borrowing(
  p_semester_id bigint default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sem public.semesters%ROWTYPE;
  v_year_id bigint;
  v_start timestamptz;
  v_end timestamptz;
  v_monthly jsonb;
  v_books_tree jsonb;
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
    v_year_id := v_sem.academic_year_id;
  end if;

  -- Monthly lines across the semester's own months.
  with months as (
    select m.start_at
    from generate_series(
      date_trunc('month', v_sem.starts_on::timestamp),
      date_trunc('month', v_sem.ends_on::timestamp),
      interval '1 month') as m(start_at)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'month', to_char(m.start_at, 'YYYY-MM'),
      'borrowed', (
        select count(*) from public.book_loans l
        where v_start is not null
          and (l.borrowed_at at time zone 'Asia/Manila') >= m.start_at
          and (l.borrowed_at at time zone 'Asia/Manila') < m.start_at + interval '1 month'),
      'returned', (
        select count(*) from public.book_loans l
        where v_start is not null
          and (l.returned_at at time zone 'Asia/Manila') >= m.start_at
          and (l.returned_at at time zone 'Asia/Manila') < m.start_at + interval '1 month'),
      'overdue', (
        select count(*) from public.book_loans l
        where v_start is not null
          and (l.borrowed_at at time zone 'Asia/Manila') >= m.start_at
          and (l.borrowed_at at time zone 'Asia/Manila') < m.start_at + interval '1 month'
          and ((l.returned_at is null and l.due_at < now())
               or (l.returned_at is not null and l.returned_at > l.due_at)))
    ) order by m.start_at), '[]'::jsonb)
  into v_monthly
  from months m;

  -- The drill tree, scoped to the semester's loan cohort.
  with loan_rows as (
    select coalesce(d.name, '(No department)') as department,
           coalesce(prog.name, '(No program)') as program,
           case when lower(btrim(u.role::text)) = 'student'
                then en.year_level end as year_level,
           b.book_name
    from public.book_loans l
    join public."usersData" u on u.id = l.user_profile_id
    join public.book_accession_numbers a on a.id = l.accession_id
    join public.books b on b.id = a.book_id
    left join public.departments d on d.id = u.department_id
    left join public.programs prog on prog.id = u.program_id
    left join public.student_enrollments en
      on en.user_profile_id = u.id and en.academic_year_id = v_year_id
    where v_start is not null
      and l.borrowed_at >= v_start and l.borrowed_at < v_end
  ),
  dept_ranked as (
    select department, book_name, count(*) as n,
           sum(count(*)) over (partition by department) as total,
           row_number() over (partition by department
                              order by count(*) desc, book_name) as rn
    from loan_rows
    group by department, book_name
  ),
  dept_books as (
    select department, max(total) as total,
           jsonb_agg(jsonb_build_object('name', book_name, 'count', n)
                     order by n desc, book_name)
             filter (where rn <= 5) as books
    from dept_ranked
    group by department
  ),
  prog_ranked as (
    select department, program, book_name, count(*) as n,
           sum(count(*)) over (partition by department, program) as total,
           row_number() over (partition by department, program
                              order by count(*) desc, book_name) as rn
    from loan_rows
    group by department, program, book_name
  ),
  prog_books as (
    select department, program, max(total) as total,
           jsonb_agg(jsonb_build_object('name', book_name, 'count', n)
                     order by n desc, book_name)
             filter (where rn <= 5) as books
    from prog_ranked
    group by department, program
  ),
  year_ranked as (
    select department, program, year_level, book_name, count(*) as n,
           sum(count(*)) over (partition by department, program, year_level) as total,
           row_number() over (partition by department, program, year_level
                              order by count(*) desc, book_name) as rn
    from loan_rows
    where year_level is not null
    group by department, program, year_level, book_name
  ),
  year_books as (
    select department, program, year_level, max(total) as total,
           jsonb_agg(jsonb_build_object('name', book_name, 'count', n)
                     order by n desc, book_name)
             filter (where rn <= 5) as books
    from year_ranked
    group by department, program, year_level
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'label', d.department,
      'count', d.total,
      'books', d.books,
      'programs', coalesce((
        select jsonb_agg(jsonb_build_object(
            'label', p.program,
            'count', p.total,
            'books', p.books,
            'years', coalesce((
              select jsonb_agg(jsonb_build_object(
                  'label', y.year_level::text,
                  'count', y.total,
                  'books', y.books)
                  order by y.year_level)
              from year_books y
              where y.department = p.department and y.program = p.program),
              '[]'::jsonb))
          order by p.total desc, p.program)
        from prog_books p
        where p.department = d.department), '[]'::jsonb))
    order by d.total desc, d.department), '[]'::jsonb)
  into v_books_tree
  from dept_books d;

  return jsonb_build_object(
    'semester', jsonb_build_object(
      'id', v_sem.id,
      'name', v_sem.name,
      'year', (select ay.name from public.academic_years ay
               where ay.id = v_sem.academic_year_id)),
    'monthly', v_monthly,
    'totals', jsonb_build_object(
      'loans', (
        select count(*) from public.book_loans l
        where v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end),
      'open', (
        select count(*) from public.book_loans l
        where v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end
          and l.returned_at is null),
      'overdue', (
        select count(*) from public.book_loans l
        where v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end
          and l.returned_at is null and l.due_at < now()),
      'returned', (
        select count(*) from public.book_loans l
        where v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end
          and l.returned_at is not null),
      'avg_days', (
        select round(avg(extract(epoch from (l.returned_at - l.borrowed_at))
                         / 86400)::numeric, 1)
        from public.book_loans l
        where v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end
          and l.returned_at is not null),
      'on_time', (
        select count(*) from public.book_loans l
        where v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end
          and l.returned_at is not null and l.returned_at <= l.due_at),
      'late', (
        select count(*) from public.book_loans l
        where v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end
          and l.returned_at is not null and l.returned_at > l.due_at)),
    'by_role', (
      select coalesce(jsonb_agg(jsonb_build_object('label', x.role, 'count', x.n)
                                order by x.n desc, x.role), '[]'::jsonb)
      from (
        select lower(btrim(u.role::text)) as role, count(*) as n
        from public.book_loans l
        join public."usersData" u on u.id = l.user_profile_id
        where v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end
        group by 1) x),
    'top_borrowers', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'name', concat_ws(' ', x.first_name, x.middle_initial,
                            x.surname, x.suffix),
          'library_id', x.library_id,
          'role', lower(btrim(x.role::text)),
          'count', x.n) order by x.n desc, x.surname, x.first_name), '[]'::jsonb)
      from (
        select u.id, u.first_name, u.middle_initial, u.surname, u.suffix,
               u.library_id, u.role, count(*) as n
        from public.book_loans l
        join public."usersData" u on u.id = l.user_profile_id
        where v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end
        group by u.id
        order by count(*) desc, u.surname, u.first_name
        limit 10) x),
    'top_books', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'name', x.book_name, 'author', x.author, 'count', x.n)
          order by x.n desc, x.book_name), '[]'::jsonb)
      from (
        select b.book_name, b.author, count(*) as n
        from public.book_loans l
        join public.book_accession_numbers a on a.id = l.accession_id
        join public.books b on b.id = a.book_id
        where v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end
        group by b.id, b.book_name, b.author
        order by count(*) desc, b.book_name
        limit 10) x),
    'books_tree', v_books_tree);
end $$;
revoke all on function public.lirc_statistics_borrowing(bigint) from public, anon;
grant execute on function public.lirc_statistics_borrowing(bigint) to authenticated;

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

  return jsonb_build_object(
    'semester', jsonb_build_object(
      'id', v_sem.id,
      'name', v_sem.name,
      'year', (select ay.name from public.academic_years ay
               where ay.id = v_sem.academic_year_id)),
    'monthly', v_monthly,
    'by_hour', v_by_hour,
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

notify pgrst, 'reload schema';
commit;
