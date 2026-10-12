-- DEMO DATA: sample book loans for the Book Borrow page.
-- Connected to real accession copies and real member profiles; every loan is
-- recorded by the first admin profile. Mix: returned history since July,
-- current loans still out, and a few overdue ones (for the warning flow).
-- The script skips itself if any loan already exists.
begin;

do $$
declare
  v_staff bigint;
  v_copies bigint[];
  v_members bigint[];
  v_copy bigint;
  v_borrowed timestamptz;
  v_due timestamptz;
  v_returned timestamptz;
  v_count int := 0;
  v_open_current int := 0;
  v_open_overdue int := 0;
  i int;
begin
  if exists (select 1 from public.book_loans) then
    raise notice 'Book loans already exist; demo seed skipped.';
    return;
  end if;

  select u.id into v_staff
  from public."usersData" u
  where lower(btrim(u.role::text)) = 'admin'
  order by u.id
  limit 1;
  if v_staff is null then
    raise notice 'No admin profile found; demo loans skipped.';
    return;
  end if;

  -- One copy from each of 30 different books.
  select array_agg(c.id) into v_copies
  from (
    select distinct on (a.book_id) a.id, a.book_id, random() as r
    from public.book_accession_numbers a
    order by a.book_id, r
    limit 30
  ) c;
  if coalesce(array_length(v_copies, 1), 0) = 0 then
    raise notice 'No accession copies found; demo loans skipped.';
    return;
  end if;

  -- Validated students first, plus a few other member roles.
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
      limit 24)
    union all
    (select u.id
       from public."usersData" u
      where lower(btrim(u.role::text)) in ('faculty', 'non_teaching_personnel', 'staff')
      order by random()
      limit 3)
  ) m;
  if coalesce(array_length(v_members, 1), 0) = 0 then
    raise notice 'No member profiles found; demo loans skipped.';
    return;
  end if;

  for i in 1..array_length(v_copies, 1) loop
    v_copy := v_copies[i];

    -- Returned history (1-2 loans per copy), inside the past.
    v_borrowed := (date '2026-07-01' + (floor(random() * 70))::int)
      + make_interval(hours => 8 + floor(random() * 9)::int,
                      mins => floor(random() * 60)::int);
    v_due := v_borrowed + interval '14 days';
    v_returned := v_borrowed + make_interval(days => 2 + floor(random() * 12)::int,
                                             hours => floor(random() * 6)::int,
                                             mins => floor(random() * 60)::int);
    insert into public.book_loans
      (accession_id, user_profile_id, borrowed_at, due_at, returned_at, recorded_by, returned_by)
    values
      (v_copy,
       v_members[1 + floor(random() * array_length(v_members, 1))::int],
       v_borrowed, v_due, v_returned, v_staff, v_staff);
    v_count := v_count + 1;

    if random() < 0.5 then
      v_borrowed := (date '2026-07-15' + (floor(random() * 55))::int)
        + make_interval(hours => 8 + floor(random() * 9)::int,
                        mins => floor(random() * 60)::int);
      v_due := v_borrowed + interval '14 days';
      v_returned := v_borrowed + make_interval(days => 1 + floor(random() * 13)::int,
                                               hours => floor(random() * 6)::int,
                                               mins => floor(random() * 60)::int);
      if v_returned < now() then
        insert into public.book_loans
          (accession_id, user_profile_id, borrowed_at, due_at, returned_at, recorded_by, returned_by)
        values
          (v_copy,
           v_members[1 + floor(random() * array_length(v_members, 1))::int],
           v_borrowed, v_due, v_returned, v_staff, v_staff);
        v_count := v_count + 1;
      end if;
    end if;

    -- Copies currently out: 12 fine (future due), 6 overdue.
    if i <= 12 then
      v_due := now() + make_interval(days => 2 + floor(random() * 10)::int,
                                     hours => 2 + floor(random() * 8)::int);
      v_borrowed := v_due - interval '14 days';
      insert into public.book_loans
        (accession_id, user_profile_id, borrowed_at, due_at, returned_at, recorded_by, returned_by)
      values
        (v_copy,
         v_members[1 + floor(random() * array_length(v_members, 1))::int],
         v_borrowed, v_due, null, v_staff, null);
      v_count := v_count + 1;
      v_open_current := v_open_current + 1;
    elsif i <= 18 then
      v_due := now() - make_interval(days => 1 + floor(random() * 12)::int,
                                     hours => 1 + floor(random() * 6)::int);
      v_borrowed := v_due - interval '14 days';
      insert into public.book_loans
        (accession_id, user_profile_id, borrowed_at, due_at, returned_at, recorded_by, returned_by)
      values
        (v_copy,
         v_members[1 + ((i - 13) % array_length(v_members, 1))],
         v_borrowed, v_due, null, v_staff, null);
      v_count := v_count + 1;
      v_open_overdue := v_open_overdue + 1;
    end if;
  end loop;

  raise notice 'Seeded % loans (% open current, % open overdue).',
    v_count, v_open_current, v_open_overdue;
end $$;

do $$
declare
  v_total bigint;
  v_open bigint;
  v_overdue bigint;
begin
  select count(*),
         count(*) filter (where returned_at is null),
         count(*) filter (where returned_at is null and due_at < now())
    into v_total, v_open, v_overdue
  from public.book_loans;
  raise notice 'Book loans now: % total, % open, % overdue.', v_total, v_open, v_overdue;
end $$;

commit;
