-- System station accounts — shared accounts for automated use by students
-- inside the library:
--
--   * 2 borrowing stations (role `system_borrow`): scan the book's accession
--     number + the borrower's library card, and the loan is recorded with the
--     standard 7-day due date. Every desk rule applies (available copy, one
--     open loan per copy, student validation, unpaid fines block).
--   * 1 attendance station (role `system_attendance`): time in / time out,
--     exactly like the desk scanner, plus a small recent-visits display.
--
-- The stations cannot open any member page or any operator function: the
-- member area bounces them to their own screen, and every station function
-- checks its own role. The attendance write guard (trigger) accepts the
-- station; reads and the desk functions stay operator-only.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- Role helpers
-- ---------------------------------------------------------------------------
create or replace function lirc_private.system_borrow_id()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select u.id from public."usersData" u
  where u.user_id = (select auth.uid())
    and lower(btrim(u.role::text)) = 'system_borrow'
  limit 1;
$$;
revoke all on function lirc_private.system_borrow_id() from public, anon, authenticated;

create or replace function lirc_private.system_attendance_id()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select u.id from public."usersData" u
  where u.user_id = (select auth.uid())
    and lower(btrim(u.role::text)) = 'system_attendance'
  limit 1;
$$;
revoke all on function lirc_private.system_attendance_id() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The attendance write guard accepts the attendance station (writes only —
-- the desk functions, the card lookup and every read stay operator-only).
-- ---------------------------------------------------------------------------
create or replace function lirc_private.guard_attendance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  staff bigint;
  visit_role text;
  term public.semesters%ROWTYPE;
  enrollment public.student_enrollments%ROWTYPE;
begin
  staff := lirc_private.attendance_staff_id();
  if staff is null then
    staff := lirc_private.system_attendance_id();
  end if;
  if staff is null then
    raise exception 'Only a signed-in admin or librarian can record attendance.';
  end if;
  if TG_OP = 'UPDATE' then
    if OLD.time_out is not null then
      raise exception 'This visit is already checked out.';
    end if;
    if NEW.time_out is null then
      raise exception 'A time-out is required.';
    end if;
    if (to_jsonb(NEW)-'time_out'-'checked_out_by')
       is distinct from (to_jsonb(OLD)-'time_out'-'checked_out_by') then
      raise exception 'Existing attendance details cannot be changed.';
    end if;
    NEW.time_out := greatest(clock_timestamp(), OLD.time_in);
    NEW.checked_out_by := staff;
    return NEW;
  end if;
  select lower(btrim(role)) into visit_role
  from public."usersData" where id = NEW.user_profile_id for update;
  if not found then raise exception 'Library user not found.'; end if;
  select * into term from public.semesters where id = NEW.semester_id for share;
  if not found or not term.is_active then
    raise exception 'New time-ins must use the active semester.';
  end if;
  if (clock_timestamp() at time zone 'Asia/Manila')::date
     not between term.starts_on and term.ends_on then
    raise exception 'The active semester is outside its date range. Ask staff to configure the current semester.';
  end if;
  NEW.purpose_of_visit := btrim(NEW.purpose_of_visit);
  NEW.role_at_visit := visit_role;
  NEW.student_enrollment_id := NULL;
  NEW.year_level := NULL;
  NEW.year_level_note := NULL;
  if visit_role = 'student' then
    select * into enrollment from public.student_enrollments
    where user_profile_id = NEW.user_profile_id
      and academic_year_id = term.academic_year_id
    for share;
    if not found then
      raise exception 'No enrollment validation for this academic year. Student is unverified.';
    end if;
    if enrollment.status <> 'enrolled' or enrollment.validated_at is null
       or (enrollment.year_level is null or enrollment.year_level not between 1 and 4) then
      raise exception 'Student is not validated as enrolled for this academic year (status: %).',
        enrollment.status;
    end if;
    NEW.student_enrollment_id := enrollment.id;
    NEW.year_level := enrollment.year_level;
    NEW.year_level_note := enrollment.year_level_note;
  end if;
  NEW.time_in := clock_timestamp();
  NEW.created_at := NEW.time_in;
  NEW.time_out := NULL;
  NEW.checked_out_by := NULL;
  NEW.recorded_by := staff;
  return NEW;
end;
$$;
revoke all on function lirc_private.guard_attendance()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: the borrowing station records a loan (accession + card)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_system_borrow(
  p_accession text,
  p_library_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me bigint;
  v_accession text;
  v_card text;
  v_accession_id bigint;
  v_status text;
  u public."usersData"%ROWTYPE;
  v_role text;
  v_active_year_id bigint;
  v_in_active_year boolean;
  e public.student_enrollments%ROWTYPE;
  v_loan_id bigint;
  v_due timestamptz;
  b public.books%ROWTYPE;
begin
  v_me := lirc_private.system_borrow_id();
  if v_me is null then
    raise exception 'Borrowing station access required.' using errcode = '42501';
  end if;

  v_accession := btrim(coalesce(p_accession, ''));
  if v_accession ~ '^\*.*\*$' and length(v_accession) > 2 then
    v_accession := substr(v_accession, 2, length(v_accession) - 2);
  end if;
  if v_accession = '' or length(v_accession) > 120 then
    raise exception 'Enter a valid accession number.';
  end if;

  v_card := btrim(coalesce(p_library_id, ''));
  if v_card = '' or length(v_card) > 120 then
    raise exception 'Enter a valid library card.';
  end if;

  select a.id, a.status into v_accession_id, v_status
  from public.book_accession_numbers a
  where a.accession_number = v_accession;
  if v_accession_id is null then
    raise exception 'Accession number % was not found.', v_accession;
  end if;
  if v_status is not null and lower(btrim(v_status)) not in ('available', '') then
    raise exception 'This copy is marked "%". Ask the librarian for help.', v_status;
  end if;
  if exists (
    select 1 from public.book_loans l
    where l.accession_id = v_accession_id and l.returned_at is null
  ) then
    raise exception 'This copy is already on loan.';
  end if;

  select * into u from public."usersData"
  where lower(library_id) = lower(v_card)
  for update;
  if not found then
    raise exception 'Library card % was not found.', v_card;
  end if;
  v_role := lower(btrim(u.role::text));

  -- Students need a validated enrollment for the school year the loan
  -- starts in (the same rule as the desk).
  if v_role = 'student' then
    select ay.id into v_active_year_id
    from public.semesters s
    join public.academic_years ay on ay.id = s.academic_year_id
    where s.is_active
    limit 1;
    if v_active_year_id is not null then
      select exists (
        select 1 from public.academic_years ay
        where ay.id = v_active_year_id
          and (now() at time zone 'Asia/Manila')::date
              between ay.starts_on and ay.ends_on
      ) into v_in_active_year;
      if v_in_active_year then
        select * into e from public.student_enrollments
        where user_profile_id = u.id and academic_year_id = v_active_year_id;
        if not found then
          raise exception 'Student has no annual validation for this school year. See the library staff.';
        end if;
        if e.status <> 'enrolled' or e.validated_at is null
           or e.year_level is null or e.year_level not between 1 and 4 then
          raise exception 'Student is not validated as enrolled (status: %). See the library staff.',
            e.status;
        end if;
      end if;
    end if;
  end if;

  -- The standard loan period (same default as the desk).
  v_due := now() + interval '7 days';

  begin
    insert into public.book_loans
      (accession_id, user_profile_id, borrowed_at, due_at, recorded_by)
    values
      (v_accession_id, u.id, now(), v_due, v_me)
    returning id into v_loan_id;
  exception when unique_violation then
    raise exception 'This copy was just borrowed. Choose another copy.';
  end;

  select b2.* into b
  from public.books b2
  join public.book_accession_numbers a2 on a2.book_id = b2.id
  where a2.id = v_accession_id;

  return jsonb_build_object(
    'id', v_loan_id,
    'book_name', b.book_name,
    'author', b.author,
    'accession_number', v_accession,
    'member_name', concat_ws(' ', u.first_name, u.middle_initial, u.surname, u.suffix),
    'library_id', u.library_id,
    'due_at', v_due);
end;
$$;
revoke all on function public.lirc_system_borrow(text, text)
  from public, anon, authenticated;
grant execute on function public.lirc_system_borrow(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: the borrowing station's recent loans (its own records only)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_system_borrow_recent()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me bigint;
begin
  v_me := lirc_private.system_borrow_id();
  if v_me is null then
    raise exception 'Borrowing station access required.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
        'id', x.id,
        'book_name', x.book_name,
        'accession_number', x.accession_number,
        'member_name', x.member_name,
        'library_id', x.library_id,
        'borrowed_at', x.borrowed_at,
        'due_at', x.due_at)
        order by x.borrowed_at desc, x.id desc)
    from (
      select l.id, b.book_name, a.accession_number,
             concat_ws(' ', u.first_name, u.middle_initial, u.surname, u.suffix) as member_name,
             u.library_id, l.borrowed_at, l.due_at
      from public.book_loans l
      join public.book_accession_numbers a on a.id = l.accession_id
      join public.books b on b.id = a.book_id
      join public."usersData" u on u.id = l.user_profile_id
      where l.recorded_by = v_me
      order by l.borrowed_at desc, l.id desc
      limit 10
    ) x), '[]'::jsonb);
end;
$$;
revoke all on function public.lirc_system_borrow_recent()
  from public, anon, authenticated;
grant execute on function public.lirc_system_borrow_recent() to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: the attendance station records a time in / time out
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
  where user_profile_id = u.id and time_out is null;

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
    insert into public.attendance (user_profile_id, semester_id, purpose_of_visit)
    values (u.id, v_term.id, v_purpose);
    v_action := 'in';
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
-- RPC: the attendance station's recent visits (display only, no filters)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_system_attendance_recent()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me bigint;
begin
  v_me := lirc_private.system_attendance_id();
  if v_me is null then
    raise exception 'Attendance station access required.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
        'id', x.id,
        'member_name', x.member_name,
        'library_id', x.library_id,
        'purpose', x.purpose,
        'time_in', x.time_in,
        'time_out', x.time_out,
        'is_open', x.is_open)
        order by x.time_in desc, x.id desc)
    from (
      select a.id,
             coalesce(nullif(btrim(a.guest_name), ''),
                      concat_ws(' ', u.first_name, u.middle_initial, u.surname, u.suffix)) as member_name,
             u.library_id,
             a.purpose_of_visit as purpose,
             a.time_in, a.time_out,
             a.time_out is null as is_open
      from public.attendance a
      left join public."usersData" u on u.id = a.user_profile_id
      order by a.time_in desc, a.id desc
      limit 10
    ) x), '[]'::jsonb);
end;
$$;
revoke all on function public.lirc_system_attendance_recent()
  from public, anon, authenticated;
grant execute on function public.lirc_system_attendance_recent() to authenticated;

-- ---------------------------------------------------------------------------
-- The three station accounts (auth user + profile). Passwords can be changed
-- with "Forgot password" like any account.
-- ---------------------------------------------------------------------------
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
       'authenticated', 'authenticated', v.email,
       extensions.crypt(v.password, extensions.gen_salt('bf')), now(),
       '{"provider": "email", "providers": ["email"]}'::jsonb,
       jsonb_build_object('library_id', v.library_id, 'first_name', v.first_name,
                          'surname', v.surname, 'email_verified', true),
       now(), now(), '', '', '', ''
from (values
  ('borrow1@ccc.edu.ph', 'Borrow1#2026', 'SYS-B1', 'Borrowing Station', '1'),
  ('borrow2@ccc.edu.ph', 'Borrow2#2026', 'SYS-B2', 'Borrowing Station', '2'),
  ('attendance@ccc.edu.ph', 'Attend#2026', 'SYS-A1', 'Attendance Station', '1')
) as v(email, password, library_id, first_name, surname)
where not exists (
  select 1 from auth.users u where u.email = v.email);

insert into auth.identities (user_id, provider_id, identity_data, provider, created_at, updated_at)
select u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email,
                          'email_verified', true, 'phone_verified', false),
       'email', now(), now()
from auth.users u
where u.email in ('borrow1@ccc.edu.ph', 'borrow2@ccc.edu.ph', 'attendance@ccc.edu.ph')
  and not exists (
    select 1 from auth.identities i
    where i.user_id = u.id and i.provider = 'email');

insert into public."usersData" (library_id, first_name, surname, role, user_id)
select v.library_id, v.first_name, v.surname, v.role,
       (select u.id from auth.users u where u.email = v.email)
from (values
  ('SYS-B1', 'Borrowing Station', '1', 'system_borrow', 'borrow1@ccc.edu.ph'),
  ('SYS-B2', 'Borrowing Station', '2', 'system_borrow', 'borrow2@ccc.edu.ph'),
  ('SYS-A1', 'Attendance Station', '1', 'system_attendance', 'attendance@ccc.edu.ph')
) as v(library_id, first_name, surname, role, email)
where not exists (
  select 1 from public."usersData" p where p.library_id = v.library_id);

notify pgrst, 'reload schema';
commit;
