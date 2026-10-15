-- ============================================================================
-- The borrowing statistics' book rankings become one drill-down tree:
-- department → program → year level, each level with its loan count and its
-- top five books. The client lists each section as clickable rows and opens
-- a modal that walks the tree one level at a time (the department's most
-- borrowed books, then a program's, then a year level's).
--
-- Replaces the three flat rankings (books_by_department, books_by_year_level,
-- books_by_program) with `books_tree`. Everything else in
-- lirc_statistics_borrowing is unchanged.
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
  v_books_tree jsonb;
begin
  if lirc_private.library_operator_id() is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  select ay.id into v_year_id
  from public.semesters s
  join public.academic_years ay on ay.id = s.academic_year_id
  where s.is_active
  limit 1;

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
    'books_tree', v_books_tree);
end $$;
revoke all on function public.lirc_statistics_borrowing() from public, anon;
grant execute on function public.lirc_statistics_borrowing() to authenticated;

notify pgrst, 'reload schema';
commit;
