-- ============================================================================
-- Security hardening from the OWASP-style audit:
--
-- 1. One open visit per member, guaranteed by the database. The station and
--    the desk both "check, then insert", so two simultaneous scans could in
--    theory record two time-ins; the partial unique index makes that
--    impossible, and the station function turns a collision into the time
--    out it would have been anyway (scan twice = in, then out).
-- 2. lirc_statistics_overview gains the operator guard its sibling statistics
--    functions already had (it only returns aggregate counts, but the
--    statistics pages are operator-only by design).
-- 3. lirc_set_my_avatar rejects ".." in the stored address (the prefix rule
--    alone accepted traversal-looking strings; they were only ever rendered
--    as an image address, never used as a file path).
-- 4. Removes the records created while auditing (one race-test loan and the
--    race-test visits).
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1) Cleanup of the audit's test records
-- ---------------------------------------------------------------------------
delete from public.library_fines
 where loan_id in (
   select id from public.book_loans
   where recorded_by = (select id from public."usersData" where library_id = 'SYS-B1'));

delete from public.book_loans
 where recorded_by = (select id from public."usersData" where library_id = 'SYS-B1');

delete from public.attendance
 where recorded_by = (select id from public."usersData" where library_id = 'SYS-A1')
   and id > 46013;

-- ---------------------------------------------------------------------------
-- 2) One open visit per member — the race-condition guarantee
-- ---------------------------------------------------------------------------
create unique index if not exists one_open_visit_per_user
  on public.attendance (user_profile_id)
  where time_out is null;

-- ---------------------------------------------------------------------------
-- 3) The attendance station handles a simultaneous-scan collision gracefully
-- ---------------------------------------------------------------------------
create or replace function public.lirc_system_attendance(
  p_library_id text,
  p_purpose text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me bigint;
  v_card text;
  v_purpose text;
  u public."usersData"%ROWTYPE;
  v_term public.semesters%ROWTYPE;
  v_visit public.attendance%ROWTYPE;
  v_action text;
begin
  v_me := lirc_private.system_attendance_id();
  if v_me is null then
    raise exception 'Attendance station access required.' using errcode = '42501';
  end if;

  v_card := btrim(coalesce(p_library_id, ''));
  if v_card = '' or length(v_card) > 120 then
    raise exception 'Enter a valid library card.';
  end if;

  select * into u from public."usersData"
  where lower(library_id) = lower(v_card)
  for update;
  if not found then
    raise exception 'Library card % was not found.', v_card;
  end if;

  select * into v_visit from public.attendance
  where user_profile_id = u.id and time_out is null
  order by time_in desc, id desc
  limit 1;

  if found then
    update public.attendance set time_out = now() where id = v_visit.id;
    v_action := 'out';
  else
    select * into v_term from public.semesters where is_active limit 1;
    if not found then
      raise exception 'No active semester. Ask the library staff.';
    end if;
    v_purpose := btrim(coalesce(p_purpose, ''));
    if v_purpose = '' then
      v_purpose := 'Study';
    end if;
    if length(v_purpose) > 250 then
      raise exception 'Keep the purpose under 250 characters.';
    end if;
    begin
      insert into public.attendance (user_profile_id, semester_id, purpose_of_visit)
      values (u.id, v_term.id, v_purpose);
      v_action := 'in';
    exception when unique_violation then
      -- A simultaneous scan just recorded the time in: this scan becomes the
      -- time out, exactly as if the card had been scanned twice.
      select * into v_visit from public.attendance
      where user_profile_id = u.id and time_out is null
      order by time_in desc, id desc
      limit 1;
      if not found then
        raise exception 'The visit was just updated. Scan the card again.';
      end if;
      update public.attendance set time_out = now() where id = v_visit.id;
      v_action := 'out';
    end;
  end if;

  return jsonb_build_object(
    'action', v_action,
    'member_name', concat_ws(' ', u.first_name, u.middle_initial, u.surname, u.suffix),
    'library_id', u.library_id,
    'role', lower(btrim(u.role::text)),
    'at', now(),
    'purpose', case when v_action = 'in' then v_purpose else null end);
end;
$$;
revoke all on function public.lirc_system_attendance(text, text)
  from public, anon, authenticated;
grant execute on function public.lirc_system_attendance(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) The statistics overview keeps the operator guard (aggregate counts only,
--    but the statistics pages are operator-only)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 5) The avatar address rejects traversal-looking strings
-- ---------------------------------------------------------------------------
create or replace function public.lirc_set_my_avatar(p_url text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me bigint := lirc_private.my_profile_id();
  v_url text := nullif(btrim(coalesce(p_url, '')), '');
begin
  if v_me is null then
    raise exception 'No library profile for this account.' using errcode = '42501';
  end if;
  if v_url is not null and v_url like '%..%' then
    raise exception 'That image address is not allowed.';
  end if;
  if v_url is not null
     and v_url not like '/images/profiles/%'
     and v_url not like '%/object/public/avatars/%' then
    raise exception 'That image address is not allowed.';
  end if;
  update public."usersData" set avatar_url = v_url where id = v_me;
  return jsonb_build_object('avatar_url', v_url);
end $$;
revoke all on function public.lirc_set_my_avatar(text) from public, anon;
grant execute on function public.lirc_set_my_avatar(text) to authenticated;

notify pgrst, 'reload schema';
commit;
