-- Member statistics, adjusted: the member's "Most borrowed" is their own
-- department's list (the same grouping the borrowing statistics use), not
-- the library-wide top books — no other department's records are included.
-- The library-wide trend block is removed with its card.
-- ============================================================================
begin;

create or replace function public.lirc_my_statistics(
  p_semester_id bigint default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me public."usersData"%ROWTYPE;
  v_sem public.semesters%ROWTYPE;
  v_start timestamptz;
  v_end timestamptz;
  v_my_months jsonb;
begin
  select * into v_me from public."usersData"
  where id = lirc_private.my_profile_id();
  if not found then
    raise exception 'Sign in first.' using errcode = '42501';
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

  -- The caller's visits per month (the semester's months).
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
          and a.user_profile_id = v_me.id
          and (a.time_in at time zone 'Asia/Manila') >= m.start_at
          and (a.time_in at time zone 'Asia/Manila') < m.start_at + interval '1 month'))
      order by m.start_at), '[]'::jsonb)
  into v_my_months
  from months m;

  return jsonb_build_object(
    'semester', jsonb_build_object(
      'id', v_sem.id,
      'name', v_sem.name,
      'year', (select ay.name from public.academic_years ay
               where ay.id = v_sem.academic_year_id)),
    'me', jsonb_build_object(
      'id', v_me.id,
      'library_id', v_me.library_id,
      'name', concat_ws(' ', v_me.first_name, v_me.middle_initial,
                        v_me.surname, v_me.suffix),
      'role', lower(btrim(v_me.role::text))),
    'borrowing', jsonb_build_object(
      'totals', jsonb_build_object(
        'loans', (
          select count(*) from public.book_loans l
          where l.user_profile_id = v_me.id
            and v_start is not null
            and l.borrowed_at >= v_start and l.borrowed_at < v_end),
        'open', (
          select count(*) from public.book_loans l
          where l.user_profile_id = v_me.id
            and v_start is not null
            and l.borrowed_at >= v_start and l.borrowed_at < v_end
            and l.returned_at is null),
        'overdue', (
          select count(*) from public.book_loans l
          where l.user_profile_id = v_me.id
            and v_start is not null
            and l.borrowed_at >= v_start and l.borrowed_at < v_end
            and l.returned_at is null and l.due_at < now()),
        'returned', (
          select count(*) from public.book_loans l
          where l.user_profile_id = v_me.id
            and v_start is not null
            and l.borrowed_at >= v_start and l.borrowed_at < v_end
            and l.returned_at is not null),
        'on_time', (
          select count(*) from public.book_loans l
          where l.user_profile_id = v_me.id
            and v_start is not null
            and l.borrowed_at >= v_start and l.borrowed_at < v_end
            and l.returned_at is not null and l.returned_at <= l.due_at),
        'late', (
          select count(*) from public.book_loans l
          where l.user_profile_id = v_me.id
            and v_start is not null
            and l.borrowed_at >= v_start and l.borrowed_at < v_end
            and l.returned_at is not null and l.returned_at > l.due_at),
        'avg_days', (
          select round(avg(extract(epoch from (l.returned_at - l.borrowed_at))
                           / 86400)::numeric, 1)
          from public.book_loans l
          where l.user_profile_id = v_me.id
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
          where l.user_profile_id = v_me.id
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
          where l.user_profile_id = v_me.id
            and v_start is not null
            and l.borrowed_at >= v_start and l.borrowed_at < v_end
          order by l.borrowed_at desc, l.id desc
          limit 10) x)),
    'attendance', jsonb_build_object(
      'totals', jsonb_build_object(
        'visits', (
          select count(*) from public.attendance a
          where a.user_profile_id = v_me.id
            and v_start is not null
            and a.time_in >= v_start and a.time_in < v_end),
        'days', (
          select count(distinct (a.time_in at time zone 'Asia/Manila')::date)
          from public.attendance a
          where a.user_profile_id = v_me.id
            and v_start is not null
            and a.time_in >= v_start and a.time_in < v_end),
        'avg_minutes', (
          select round(avg(extract(epoch from (a.time_out - a.time_in))
                           / 60)::numeric, 1)
          from public.attendance a
          where a.user_profile_id = v_me.id
            and v_start is not null
            and a.time_in >= v_start and a.time_in < v_end
            and a.time_out is not null),
        'last_visit_day', (
          select to_char(max(a.time_in) at time zone 'Asia/Manila',
                         'YYYY-MM-DD')
          from public.attendance a
          where a.user_profile_id = v_me.id)),
      'months', v_my_months,
      'recent', (
        select coalesce(jsonb_agg(jsonb_build_object(
            'id', x.id,
            'time_in', x.time_in,
            'time_out', x.time_out,
            'minutes', x.minutes,
            'purpose', x.purpose,
            'is_open', x.is_open)
            order by x.time_in desc, x.id desc), '[]'::jsonb)
        from (
          select a.id, a.time_in, a.time_out,
                 case when a.time_out is null then null
                      else round(extract(epoch from a.time_out - a.time_in) / 60)
                      end as minutes,
                 a.purpose_of_visit as purpose,
                 a.time_out is null as is_open
          from public.attendance a
          where a.user_profile_id = v_me.id
            and v_start is not null
            and a.time_in >= v_start and a.time_in < v_end
          order by a.time_in desc, a.id desc
          limit 10) x)),
    'department', jsonb_build_object(
      'id', v_me.department_id,
      'name', (select d.name from public.departments d
               where d.id = v_me.department_id),
      -- The caller's own department only; members without a department
      -- fall back to the whole library (there is nothing to scope to).
      'popular', (
        select coalesce(jsonb_agg(jsonb_build_object(
            'id', x.book_id, 'name', x.book_name, 'author', x.author,
            'count', x.n)
            order by x.n desc, x.book_name), '[]'::jsonb)
        from (
          select b.id as book_id, b.book_name, b.author, count(*) as n
          from public.book_loans l
          join public.book_accession_numbers a on a.id = l.accession_id
          join public.books b on b.id = a.book_id
          join public."usersData" u on u.id = l.user_profile_id
          where v_start is not null
            and l.borrowed_at >= v_start and l.borrowed_at < v_end
            and (v_me.department_id is null
                 or u.department_id = v_me.department_id)
          group by b.id, b.book_name, b.author
          order by count(*) desc, b.book_name
          limit 10) x)));
end $$;

revoke all on function public.lirc_my_statistics(bigint)
  from public, anon, authenticated;
grant execute on function public.lirc_my_statistics(bigint) to authenticated;

notify pgrst, 'reload schema';
commit;
