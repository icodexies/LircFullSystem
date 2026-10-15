-- ============================================================================
-- Statistics detail: borrowing and attendance analytics for the clickable
-- category cards. All aggregates; guarded to staff / librarian / admin
-- (the summary overview stays open to every signed-in member).
--
--   * lirc_statistics_borrowing — 12-month monthly series (borrowed,
--     returned, overdue), totals (open, overdue, average days, on-time),
--     loans by visitor type, most active borrowers, overall top books, and
--     the most borrowed books grouped three ways: by department, by year
--     level and by program (borrower's current classification; students'
--     year level comes from the active academic year's enrollment).
--   * lirc_statistics_attendance — 12-month monthly series (visits, unique
--     visitors), visits by Manila hour, by purpose, by visitor type, by
--     department, most frequent visitors, and totals (average stay,
--     busiest day, inside now).
--   * lirc_statistics_overview — extended with members by department and
--     the active year's validation status breakdown (for the member,
--     validation and catalog detail views).
--
-- "Overdue" in the monthly series means loans whose due date fell in that
-- month and missed it (still open past due, or returned after the due date).
-- ============================================================================
begin;

create or replace function public.lirc_statistics_borrowing()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_year_id bigint;
  v_monthly jsonb;
  v_books_department jsonb;
  v_books_year jsonb;
  v_books_program jsonb;
begin
  if lirc_private.library_operator_id() is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  select ay.id into v_year_id
  from public.semesters s
  join public.academic_years ay on ay.id = s.academic_year_id
  where s.is_active
  limit 1;

  -- Monthly series: the last 12 Manila months, empty months included.
  with months as (
    select date_trunc('month', (now() at time zone 'Asia/Manila'))
             - (n || ' months')::interval as start_at
    from generate_series(11, 0, -1) as n
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'month', to_char(m.start_at, 'YYYY-MM'),
      'borrowed', (
        select count(*) from public.book_loans l
        where (l.borrowed_at at time zone 'Asia/Manila') >= m.start_at
          and (l.borrowed_at at time zone 'Asia/Manila') < m.start_at + interval '1 month'),
      'returned', (
        select count(*) from public.book_loans l
        where (l.returned_at at time zone 'Asia/Manila') >= m.start_at
          and (l.returned_at at time zone 'Asia/Manila') < m.start_at + interval '1 month'),
      'overdue', (
        select count(*) from public.book_loans l
        where (l.due_at at time zone 'Asia/Manila') >= m.start_at
          and (l.due_at at time zone 'Asia/Manila') < m.start_at + interval '1 month'
          and ((l.returned_at is null and l.due_at < now())
               or (l.returned_at is not null and l.returned_at > l.due_at)))
    ) order by m.start_at), '[]'::jsonb)
  into v_monthly
  from months m;

  -- Loan rows with the borrower's current classification (student year
  -- level from the active academic year's enrollment).
  with loan_rows as (
    select coalesce(d.name, '(No department)') as department,
           prog.name as program,
           case when lower(btrim(u.role::text)) = 'student' then en.year_level end as year_level,
           b.book_name
    from public.book_loans l
    join public."usersData" u on u.id = l.user_profile_id
    join public.book_accession_numbers a on a.id = l.accession_id
    join public.books b on b.id = a.book_id
    left join public.departments d on d.id = u.department_id
    left join public.programs prog on prog.id = u.program_id
    left join public.student_enrollments en
      on en.user_profile_id = u.id and en.academic_year_id = v_year_id
  ),
  ranked as (
    select department as label, book_name, count(*) as n,
           sum(count(*)) over (partition by department) as total,
           row_number() over (partition by department
                              order by count(*) desc, book_name) as rn
    from loan_rows
    group by department, book_name
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'label', x.label, 'count', x.total, 'books', x.books)
      order by x.total desc, x.label), '[]'::jsonb)
  into v_books_department
  from (
    select label, max(total) as total,
           jsonb_agg(jsonb_build_object('name', book_name, 'count', n)
                     order by n desc, book_name)
             filter (where rn <= 5) as books
    from ranked
    group by label
  ) x;

  with loan_rows as (
    select en.year_level as label, b.book_name
    from public.book_loans l
    join public."usersData" u on u.id = l.user_profile_id
    join public.book_accession_numbers a on a.id = l.accession_id
    join public.books b on b.id = a.book_id
    join public.student_enrollments en
      on en.user_profile_id = u.id and en.academic_year_id = v_year_id
    where lower(btrim(u.role::text)) = 'student' and en.year_level is not null
  ),
  ranked as (
    select label, book_name, count(*) as n,
           sum(count(*)) over (partition by label) as total,
           row_number() over (partition by label
                              order by count(*) desc, book_name) as rn
    from loan_rows
    group by label, book_name
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'label', x.label::text, 'count', x.total, 'books', x.books)
      order by x.label), '[]'::jsonb)
  into v_books_year
  from (
    select label, max(total) as total,
           jsonb_agg(jsonb_build_object('name', book_name, 'count', n)
                     order by n desc, book_name)
             filter (where rn <= 5) as books
    from ranked
    group by label
  ) x;

  with loan_rows as (
    select prog.name as label, b.book_name
    from public.book_loans l
    join public."usersData" u on u.id = l.user_profile_id
    join public.book_accession_numbers a on a.id = l.accession_id
    join public.books b on b.id = a.book_id
    join public.programs prog on prog.id = u.program_id
  ),
  ranked as (
    select label, book_name, count(*) as n,
           sum(count(*)) over (partition by label) as total,
           row_number() over (partition by label
                              order by count(*) desc, book_name) as rn
    from loan_rows
    group by label, book_name
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'label', x.label, 'count', x.total, 'books', x.books)
      order by x.total desc, x.label), '[]'::jsonb)
  into v_books_program
  from (
    select label, max(total) as total,
           jsonb_agg(jsonb_build_object('name', book_name, 'count', n)
                     order by n desc, book_name)
             filter (where rn <= 5) as books
    from ranked
    group by label
  ) x;

  return jsonb_build_object(
    'monthly', v_monthly,
    'totals', jsonb_build_object(
      'loans', (select count(*) from public.book_loans),
      'open', (select count(*) from public.book_loans where returned_at is null),
      'overdue', (
        select count(*) from public.book_loans
        where returned_at is null and due_at < now()),
      'returned', (
        select count(*) from public.book_loans where returned_at is not null),
      'avg_days', (
        select round(avg(extract(epoch from (returned_at - borrowed_at))
                         / 86400)::numeric, 1)
        from public.book_loans where returned_at is not null),
      'on_time', (
        select count(*) from public.book_loans
        where returned_at is not null and returned_at <= due_at),
      'late', (
        select count(*) from public.book_loans
        where returned_at is not null and returned_at > due_at)),
    'by_role', (
      select coalesce(jsonb_agg(jsonb_build_object('label', x.role, 'count', x.n)
                                order by x.n desc, x.role), '[]'::jsonb)
      from (
        select lower(btrim(u.role::text)) as role, count(*) as n
        from public.book_loans l
        join public."usersData" u on u.id = l.user_profile_id
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
        group by b.id, b.book_name, b.author
        order by count(*) desc, b.book_name
        limit 10) x),
    'books_by_department', v_books_department,
    'books_by_year_level', v_books_year,
    'books_by_program', v_books_program);
end $$;
revoke all on function public.lirc_statistics_borrowing() from public, anon;
grant execute on function public.lirc_statistics_borrowing() to authenticated;

create or replace function public.lirc_statistics_attendance()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_monthly jsonb;
  v_by_hour jsonb;
begin
  if lirc_private.library_operator_id() is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;

  with months as (
    select date_trunc('month', (now() at time zone 'Asia/Manila'))
             - (n || ' months')::interval as start_at
    from generate_series(11, 0, -1) as n
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'month', to_char(m.start_at, 'YYYY-MM'),
      'visits', (
        select count(*) from public.attendance a
        where (a.time_in at time zone 'Asia/Manila') >= m.start_at
          and (a.time_in at time zone 'Asia/Manila') < m.start_at + interval '1 month'),
      'unique_visitors', (
        select count(distinct a.user_profile_id) from public.attendance a
        where (a.time_in at time zone 'Asia/Manila') >= m.start_at
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
    where a.time_in >= now() - interval '12 months'
    group by 1) v on v.hour = h.hour;

  return jsonb_build_object(
    'monthly', v_monthly,
    'by_hour', v_by_hour,
    'totals', jsonb_build_object(
      'visits', (
        select count(*) from public.attendance
        where time_in >= now() - interval '12 months'),
      'unique_visitors', (
        select count(distinct user_profile_id) from public.attendance
        where time_in >= now() - interval '12 months'),
      'inside', (select count(*) from public.attendance where time_out is null),
      'avg_minutes', (
        select round(avg(extract(epoch from (time_out - time_in)) / 60)::numeric, 1)
        from public.attendance
        where time_in >= now() - interval '12 months' and time_out is not null),
      'busiest_day', (
        select jsonb_build_object('date', x.day, 'visits', x.n)
        from (
          select (a.time_in at time zone 'Asia/Manila')::date as day, count(*) as n
          from public.attendance a
          where a.time_in >= now() - interval '12 months'
          group by 1
          order by n desc, day
          limit 1) x)),
    'by_role', (
      select coalesce(jsonb_agg(jsonb_build_object('label', x.role, 'count', x.n)
                                order by x.n desc, x.role), '[]'::jsonb)
      from (
        select lower(btrim(a.role_at_visit)) as role, count(*) as n
        from public.attendance a
        where a.time_in >= now() - interval '12 months'
        group by 1) x),
    'by_purpose', (
      select coalesce(jsonb_agg(jsonb_build_object('label', x.purpose, 'count', x.n)
                                order by x.n desc, x.purpose), '[]'::jsonb)
      from (
        select a.purpose_of_visit as purpose, count(*) as n
        from public.attendance a
        where a.time_in >= now() - interval '12 months'
        group by 1) x),
    'by_department', (
      select coalesce(jsonb_agg(jsonb_build_object('label', x.label, 'count', x.n)
                                order by x.n desc, x.label), '[]'::jsonb)
      from (
        select coalesce(d.name, '(No department)') as label, count(*) as n
        from public.attendance a
        join public."usersData" u on u.id = a.user_profile_id
        left join public.departments d on d.id = u.department_id
        where a.time_in >= now() - interval '12 months'
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
        where a.time_in >= now() - interval '12 months'
        group by u.id
        order by count(*) desc, u.surname, u.first_name
        limit 10) x));
end $$;
revoke all on function public.lirc_statistics_attendance() from public, anon;
grant execute on function public.lirc_statistics_attendance() to authenticated;

-- The overview gains the two extra breakdowns the detail views read.
create or replace function public.lirc_statistics_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sem public.semesters%ROWTYPE;
  v_year_name text;
begin
  select * into v_sem from public.semesters where is_active limit 1;
  if v_sem.id is not null then
    select ay.name into v_year_name
    from public.academic_years ay where ay.id = v_sem.academic_year_id;
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
      'total', (select count(*) from public.book_loans),
      'open', (select count(*) from public.book_loans where returned_at is null),
      'overdue', (
        select count(*) from public.book_loans
        where returned_at is null and due_at < now()),
      'returned', (
        select count(*) from public.book_loans where returned_at is not null)),
    'members', jsonb_build_object(
      'total', (select count(*) from public."usersData"),
      'by_role', (
        select coalesce(jsonb_object_agg(x.role, x.n), '{}'::jsonb)
        from (
          select lower(btrim(role::text)) as role, count(*) as n
          from public."usersData"
          group by 1) x),
      'by_department', (
        select coalesce(jsonb_agg(jsonb_build_object('label', x.label, 'count', x.n)
                                  order by x.n desc, x.label), '[]'::jsonb)
        from (
          select coalesce(d.name, '(No department)') as label, count(*) as n
          from public."usersData" u
          left join public.departments d on d.id = u.department_id
          group by 1
          order by n desc, label
          limit 10) x),
      'students', (
        select count(*) from public."usersData"
        where lower(btrim(role::text)) = 'student')),
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
        select count(*) from public.attendance
        where semester_id = v_sem.id),
      'unique_visitors', (
        select count(distinct user_profile_id) from public.attendance
        where semester_id = v_sem.id),
      'inside', (
        select count(*) from public.attendance where time_out is null)));
end $$;
revoke all on function public.lirc_statistics_overview() from public, anon;
grant execute on function public.lirc_statistics_overview() to authenticated;

notify pgrst, 'reload schema';
commit;
