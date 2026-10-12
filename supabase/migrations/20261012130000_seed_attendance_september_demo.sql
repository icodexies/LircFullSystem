-- DEMO DATA: 10,000 closed library visits spread evenly across September 2026.
-- Applied through the normal migration workflow so it is recorded in history.
--
-- Safety: attendance was empty for September; the script also skips itself if
-- September rows already exist (so replaying history can never double-seed).
-- Everything runs in one transaction: a failure saves nothing, including the
-- temporary trigger switch below.
--
-- Why the trigger is switched off during the insert:
-- lirc_private.guard_attendance() only accepts NEW time-ins recorded "now" in
-- the ACTIVE semester by signed-in staff. That is exactly right for real use,
-- but backfilling September history needs the rows written directly with
-- their correct September timestamps and scanner-style snapshot fields.
--
-- REMOVE THE DEMO DATA LATER (run on its own, e.g. in the SQL editor):
--   delete from public.attendance
--   where time_in >= timestamptz '2026-09-01 00:00+08'
--     and time_in <  timestamptz '2026-10-01 00:00+08';

begin;

alter table public.attendance disable trigger user;

do $$
declare
  v_target int := 10000;
  v_staff bigint;
  v_academic_year_id bigint;
  v_student_count int;
  v_enrollment_ids bigint[];
  v_profile_ids bigint[];
  v_year_levels int[];
  v_notes text[];
  v_days date[];
  v_semesters bigint[];
  v_day_count int;
  v_day date;
  v_semester_id bigint;
  v_i int;
  v_s int;
  v_day_idx int;
  v_hour int;
  v_min int;
  v_duration int;
  v_in timestamptz;
  v_out timestamptz;
  v_purpose text;
  v_purposes text[] := array['Reading','Studying','Research','Borrowing/Returning','Computer Use','Other'];
  v_inserted int := 0;
begin
  -- 1) Never double-seed September 2026 (skip quietly on replays).
  if exists (
    select 1 from public.attendance
    where time_in >= timestamptz '2026-09-01 00:00+08'
      and time_in <  timestamptz '2026-10-01 00:00+08'
  ) then
    raise notice 'September 2026 already has attendance rows; demo seed skipped.';
    return;
  end if;

  -- 2) The staff account reports will show as recorder / checker.
  select u.id into v_staff
  from public."usersData" u
  where lower(btrim(u.role::text)) in ('admin','librarian')
  order by u.id
  limit 1;
  if v_staff is null then
    raise exception 'No admin/librarian profile found to record these visits.';
  end if;

  -- 3) Every September day that falls inside a semester, and that semester.
  select array_agg(d.day order by d.day), array_agg(d.semester_id order by d.day)
    into v_days, v_semesters
  from (
    select g.d::date as day, s.id as semester_id
    from generate_series(date '2026-09-01', date '2026-09-30', interval '1 day') as g(d)
    join public.semesters s on g.d between s.starts_on and s.ends_on
  ) d;
  if v_days is null then
    raise exception 'No semester covers September 2026. Check Academic periods first.';
  end if;
  v_day_count := array_length(v_days, 1);
  raise notice 'September days found inside the school calendar: %', v_day_count;

  if (select count(distinct s.academic_year_id) from public.semesters s where s.id = any(v_semesters)) <> 1 then
    raise exception 'September 2026 spans more than one academic year in this calendar. Review Academic periods.';
  end if;
  select min(s.academic_year_id) into v_academic_year_id
  from public.semesters s where s.id = any(v_semesters);

  -- 4) The pool of visitors: fully validated students of that academic year,
  --    with their enrollment row and confirmed level (same rule as the scanner).
  select
      array_agg(x.enrollment_id  order by x.enrollment_id),
      array_agg(x.user_profile_id order by x.enrollment_id),
      array_agg(x.year_level::int order by x.enrollment_id),
      array_agg(x.year_level_note::text order by x.enrollment_id)
    into v_enrollment_ids, v_profile_ids, v_year_levels, v_notes
  from (
    select e.id as enrollment_id, e.user_profile_id, e.year_level, e.year_level_note
    from public.student_enrollments e
    join public."usersData" u on u.id = e.user_profile_id
    where e.academic_year_id = v_academic_year_id
      and e.status = 'enrolled'
      and e.validated_at is not null
      and e.year_level between 1 and 4
      and lower(btrim(u.role::text)) = 'student'
  ) x;
  v_student_count := coalesce(array_length(v_profile_ids, 1), 0);
  if v_student_count = 0 then
    raise exception 'No validated students found for the September semester. Validate enrollments first.';
  end if;
  raise notice 'Validated students available as visitors: %', v_student_count;

  -- 5) Write the visits: an even share for every qualifying September day.
  for v_i in 1..v_target loop
    v_day_idx := ((v_i - 1) % v_day_count) + 1;
    v_day := v_days[v_day_idx];
    v_semester_id := v_semesters[v_day_idx];
    v_s := (floor(random() * v_student_count) + 1)::int;

    -- Visit between 07:00 and 18:59 Manila time, lasting 5-179 minutes.
    v_hour := 7 + floor(random() * 12)::int;
    v_min := floor(random() * 60)::int;
    v_in := (v_day + make_interval(hours => v_hour, mins => v_min))::timestamp at time zone 'Asia/Manila';
    v_duration := 5 + floor(random() * 175)::int;
    v_out := v_in + make_interval(mins => v_duration);
    v_purpose := v_purposes[1 + floor(random() * array_length(v_purposes, 1))::int];

    insert into public.attendance
      (user_profile_id, semester_id, purpose_of_visit, time_in, time_out, created_at,
       role_at_visit, year_level, year_level_note, student_enrollment_id,
       recorded_by, checked_out_by)
    values
      (v_profile_ids[v_s], v_semester_id, v_purpose, v_in, v_out, v_in,
       'student', v_year_levels[v_s], v_notes[v_s], v_enrollment_ids[v_s],
       v_staff, v_staff);

    v_inserted := v_inserted + 1;
  end loop;

  if v_inserted <> v_target then
    raise exception 'Only % of % visits inserted. Nothing was saved.', v_inserted, v_target;
  end if;
  raise notice 'Seeded % visits.', v_inserted;
end $$;

alter table public.attendance enable trigger user;

commit;

-- Final count (safety net; the seed already raised notices above).
do $$
declare v bigint;
begin
  select count(*) into v
  from public.attendance
  where time_in >= timestamptz '2026-09-01 00:00+08'
    and time_in <  timestamptz '2026-10-01 00:00+08';
  raise notice 'September 2026 visits now in the table: %', v;
end $$;
