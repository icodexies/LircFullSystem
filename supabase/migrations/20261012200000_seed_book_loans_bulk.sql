-- DEMO DATA: grows public.book_loans to 12,000 sample loans.
-- Real copies, real member profiles, recorded by the first admin profile.
-- Layout: returned history spread over the past two years, ~190 loans still
-- out with a future due date, and ~30 overdue ones (for the warning flow).
-- Safe: skips itself once the table already holds 12,000+ loans, and its
-- effect can be removed later with supabase/manual/lirc_clear_book_loans_demo.sql.
begin;

do $$
declare
  v_target int := 12000;
  v_staff bigint;
  v_current int;
  v_needed int;
  v_members bigint[];
  v_member_count int;
  v_pool bigint[];
  v_open_pool bigint[];
  v_borrowed timestamptz;
  v_due timestamptz;
  v_returned timestamptz;
  v_day date;
  v_days int;
  v_min_day date := date '2024-06-01';
  v_i int;
  v_open int := 0;
  v_overdue int := 0;
  v_history int;
begin
  select count(*) into v_current from public.book_loans;
  if v_current >= v_target then
    raise notice 'Book loans already at % (target %); bulk seed skipped.', v_current, v_target;
    return;
  end if;

  select u.id into v_staff
  from public."usersData" u
  where lower(btrim(u.role::text)) = 'admin'
  order by u.id
  limit 1;
  if v_staff is null then
    raise notice 'No admin profile found; bulk seed skipped.';
    return;
  end if;

  -- Member pool: validated students first, plus a few other member roles.
  select array_agg(m.id) into v_members
  from (
    (select e.user_profile_id as id
       from public.student_enrollments e
       join public."usersData" u on u.id = e.user_profile_id
      where e.status = 'enrolled'
        and e.validated_at is not null
        and e.year_level between 1 and 4
        and lower(btrim(u.role::text)) = 'student'
      order by random()
      limit 400)
    union all
    (select u.id
       from public."usersData" u
      where lower(btrim(u.role::text)) in ('faculty', 'non_teaching_personnel', 'staff')
      order by random()
      limit 10)
  ) m;
  v_member_count := coalesce(array_length(v_members, 1), 0);
  if v_member_count = 0 then
    raise notice 'No member profiles found; bulk seed skipped.';
    return;
  end if;

  -- Every copy, shuffled once, for fast random history picks.
  select array_agg(c.id) into v_pool
  from (select a.id from public.book_accession_numbers a order by random()) c;
  if coalesce(array_length(v_pool, 1), 0) = 0 then
    raise notice 'No accession copies found; bulk seed skipped.';
    return;
  end if;

  -- Copies without an open loan, shuffled: the open loans below take the
  -- first 220, so each copy is out at most once (unique index safe).
  select array_agg(c.id) into v_open_pool
  from (
    select a.id
    from public.book_accession_numbers a
    where not exists (
      select 1 from public.book_loans l
      where l.accession_id = a.id and l.returned_at is null
    )
    order by random()
    limit 220
  ) c;

  -- Loans currently out: 190 with a future due date, 30 overdue.
  for v_i in 1..coalesce(array_length(v_open_pool, 1), 0) loop
    if v_i <= 190 then
      v_borrowed := now()
        - make_interval(days => 2 + floor(random() * 11)::int,
                        hours => floor(random() * 10)::int,
                        mins => floor(random() * 60)::int);
      v_due := v_borrowed + interval '14 days';
      insert into public.book_loans
        (accession_id, user_profile_id, borrowed_at, due_at, returned_at, recorded_by, returned_by)
      values
        (v_open_pool[v_i],
         v_members[1 + floor(random() * v_member_count)::int],
         v_borrowed, v_due, null, v_staff, null);
      v_open := v_open + 1;
    else
      v_borrowed := now()
        - make_interval(days => 16 + floor(random() * 28)::int,
                        hours => 1 + floor(random() * 8)::int,
                        mins => floor(random() * 60)::int);
      v_due := v_borrowed + interval '14 days';
      insert into public.book_loans
        (accession_id, user_profile_id, borrowed_at, due_at, returned_at, recorded_by, returned_by)
      values
        (v_open_pool[v_i],
         v_members[1 + floor(random() * v_member_count)::int],
         v_borrowed, v_due, null, v_staff, null);
      v_overdue := v_overdue + 1;
    end if;
  end loop;

  -- Returned history, spread over the past two years (library hours only).
  select count(*) into v_current from public.book_loans;
  v_needed := v_target - v_current;
  v_days := current_date - v_min_day - 4;
  for v_i in 1..v_needed loop
    v_day := v_min_day + floor(random() * v_days)::int;
    v_borrowed := v_day
      + make_interval(hours => 8 + floor(random() * 10)::int,
                      mins => floor(random() * 60)::int);
    v_due := v_borrowed + interval '14 days';
    v_returned := least(
      v_borrowed + make_interval(days => 1 + floor(random() * 19)::int,
                                  hours => floor(random() * 10)::int,
                                  mins => floor(random() * 60)::int),
      now() - interval '1 hour');
    insert into public.book_loans
      (accession_id, user_profile_id, borrowed_at, due_at, returned_at, recorded_by, returned_by)
    values
      (v_pool[1 + floor(random() * array_length(v_pool, 1))::int],
       v_members[1 + floor(random() * v_member_count)::int],
       v_borrowed, v_due, v_returned, v_staff, v_staff);
    v_history := coalesce(v_history, 0) + 1;
  end loop;

  raise notice 'Bulk seed added % history loans, % current open, % overdue open.',
    v_history, v_open, v_overdue;
end $$;

-- Verification: totals should now show 12000 total.
do $$
declare
  v_total bigint;
  v_open bigint;
  v_overdue bigint;
  v_books bigint;
  v_members bigint;
begin
  select count(*),
         count(*) filter (where returned_at is null),
         count(*) filter (where returned_at is null and due_at < now()),
         count(distinct a.book_id),
         count(distinct user_profile_id)
    into v_total, v_open, v_overdue, v_books, v_members
  from public.book_loans l
  join public.book_accession_numbers a on a.id = l.accession_id;
  raise notice 'Book loans now: % total, % open, % overdue, across % books and % members.',
    v_total, v_open, v_overdue, v_books, v_members;
end $$;

commit;
