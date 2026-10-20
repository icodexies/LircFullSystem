-- ============================================================================
-- Year-level anchor for late library cards.
--
-- Normal students: the level comes from the library card year minus recorded
-- leave years (unchanged).
--
-- Special cases (for example a 4th-year student who only got a 26-**** card
-- this year): during validation, library staff can type the student's real
-- level. That level is saved as the ANCHOR for that school year, and from
-- then on the system advances it automatically one level per school year
-- (minus leave years). Staff never type it twice.
--
-- The newest manual record is the anchor; the derived path keeps working for
-- every other student. A guarded self-check proves the anchor advances.
-- ============================================================================
begin;

create or replace function lirc_private.derived_year_level(
  p_profile bigint,
  p_year bigint
)
returns smallint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_target_start integer;
  v_admission integer;
  v_anchor_level integer;
  v_anchor_start integer;
  v_leaves integer;
  v_level integer;
begin
  select ay.start_year into v_target_start
  from public.academic_years ay
  where ay.id = p_year;
  if v_target_start is null then
    return null;
  end if;

  select 2000 + substring(u.library_id from 1 for 2)::integer into v_admission
  from public."usersData" u
  where u.id = p_profile
    and u.library_id ~ '^[0-9]{2}-';

  -- A level typed by staff is the anchor: it advances one level per school
  -- year from the year it was entered, so it only has to be typed once.
  select e.year_level, ay.start_year
    into v_anchor_level, v_anchor_start
  from public.student_enrollments e
  join public.academic_years ay on ay.id = e.academic_year_id
  where e.user_profile_id = p_profile
    and e.year_level_source = 'manual'
    and e.year_level is not null
  order by ay.start_year desc, e.id desc
  limit 1;

  if v_anchor_level is not null then
    select count(*) into v_leaves
    from public.student_enrollments e2
    join public.academic_years ay2 on ay2.id = e2.academic_year_id
    where e2.user_profile_id = p_profile
      and e2.status = 'leave_of_absence'
      and ay2.start_year >= v_anchor_start
      and ay2.start_year < v_target_start;
    v_level := v_anchor_level + (v_target_start - v_anchor_start) - v_leaves;
  elsif v_admission is not null then
    select count(*) into v_leaves
    from public.student_enrollments e2
    join public.academic_years ay2 on ay2.id = e2.academic_year_id
    where e2.user_profile_id = p_profile
      and e2.status = 'leave_of_absence'
      and ay2.start_year >= v_admission
      and ay2.start_year < v_target_start;
    v_level := v_target_start - v_admission + 1 - v_leaves;
  else
    return null;
  end if;

  return case when v_level between 1 and 4 then v_level::smallint else null end;
end;
$$;
revoke all on function lirc_private.derived_year_level(bigint, bigint)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The write guard: unchanged behavior, clearer message for anchored levels.
-- ---------------------------------------------------------------------------
create or replace function lirc_private.guard_student_enrollment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  staff bigint;
  student_role text;
begin
  -- Internal recompute of derived levels: only derived levels change;
  -- manually entered levels (irregular students) are left alone.
  if TG_OP = 'UPDATE' and coalesce(current_setting('lirc.level_recompute', true), '') = 'on' then
    if NEW.year_level_source is distinct from 'manual' then
      NEW.year_level := lirc_private.derived_year_level(NEW.user_profile_id, NEW.academic_year_id);
      NEW.year_level_source := 'derived';
    end if;
    return NEW;
  end if;

  staff := lirc_private.attendance_staff_id();
  -- Unverified records may be created by any library operator (Add User);
  -- validating (any other status) still needs a signed-in admin or librarian.
  if staff is null and NEW.status <> 'unverified' then
    raise exception 'A signed-in admin or librarian must validate enrollment.';
  end if;
  -- Serialize with time-in for this student so status cannot change mid-validation.
  select lower(btrim(role)) into student_role
  from public."usersData"
  where id = NEW.user_profile_id
  for update;
  if student_role is distinct from 'student' then
    raise exception 'Enrollment records are for students only.';
  end if;
  if TG_OP = 'UPDATE' then
    if (NEW.user_profile_id, NEW.academic_year_id, NEW.legacy_semester_id)
       is distinct from (OLD.user_profile_id, OLD.academic_year_id, OLD.legacy_semester_id) then
      raise exception 'Enrollment student, academic year, and migration provenance cannot be changed.';
    end if;
    NEW.created_at := OLD.created_at;
  end if;
  if TG_OP = 'INSERT' and NEW.legacy_semester_id is not null then
    raise exception 'New annual enrollment records must not set legacy_semester_id.';
  end if;

  -- Past school years change only through the approval workflow.
  if coalesce(current_setting('lirc.approved_change', true), '') <> 'on'
     and (select (now() at time zone 'Asia/Manila')::date > ay.ends_on
            from public.academic_years ay where ay.id = NEW.academic_year_id) then
    raise exception 'Past school years need admin approval. Submit a change request instead.';
  end if;

  -- A level typed when the record is created counts as manual (late cards,
  -- irregular or continuing students).
  if TG_OP = 'INSERT' and NEW.year_level is not null then
    NEW.year_level_source := coalesce(NEW.year_level_source, 'manual');
  end if;

  if NEW.status = 'unverified' then
    NEW.validated_at := null;
    NEW.validated_by := null;
    -- Keep a manually entered level; derived levels only exist while validated.
    if NEW.year_level_source is distinct from 'manual' then
      NEW.year_level := null;
      NEW.year_level_source := null;
    end if;
    NEW.validation_reference := null;
  else
    NEW.validated_at := now();
    NEW.validated_by := staff;
    if NEW.year_level is not null and NEW.year_level_source = 'manual' then
      -- Keep the manually entered level (the anchor for later years).
      null;
    else
      NEW.year_level := lirc_private.derived_year_level(NEW.user_profile_id, NEW.academic_year_id);
      NEW.year_level_source := 'derived';
      if NEW.status = 'enrolled' and NEW.year_level is null then
        raise exception 'This student would be past four years of study. Record them as graduated, withdrawn or on leave instead.';
      end if;
    end if;
  end if;
  NEW.updated_at := now();
  return NEW;
end;
$$;
revoke all on function lirc_private.guard_student_enrollment()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Validation history: expose where the level came from ("manual" = set).
-- ---------------------------------------------------------------------------
create or replace function public.lirc_student_validation_history(p_profile_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if lirc_private.attendance_staff_id() is null then
    raise exception 'Staff access required.' using errcode = '42501';
  end if;
  if not exists (select 1 from public."usersData" where id = p_profile_id) then
    raise exception 'Library member not found.';
  end if;
  select jsonb_build_object('years', coalesce(jsonb_agg(jsonb_build_object(
      'academic_year_id', x.id,
      'name', x.name,
      'starts_on', x.starts_on,
      'ends_on', x.ends_on,
      'is_past', x.is_past,
      'before_admission', x.before_admission,
      'enrollment_id', x.enrollment_id,
      'status', x.status,
      'year_level', x.year_level,
      'year_level_source', x.year_level_source,
      'validated_at', x.validated_at,
      'validator', x.validator,
      'pending', x.pending
    ) order by x.start_year desc), '[]'::jsonb))
  into result
  from (
    select ay.id, ay.name, ay.start_year, ay.starts_on, ay.ends_on,
      ((now() at time zone 'Asia/Manila')::date > ay.ends_on) as is_past,
      case when u.library_id ~ '^[0-9]{2}-'
           then ay.start_year < 2000 + substring(u.library_id from 1 for 2)::integer
           else false end as before_admission,
      e.id as enrollment_id, e.status, e.year_level, e.year_level_source,
      e.validated_at,
      nullif(concat_ws(' ', ve.first_name, ve.surname), '') as validator,
      case when r.id is null then null else jsonb_build_object(
        'id', r.id,
        'requested_status', r.requested_status,
        'previous_status', r.previous_status,
        'requested_by', nullif(concat_ws(' ', rb.first_name, rb.surname), ''),
        'created_at', r.created_at) end as pending
    from public.academic_years ay
    cross join public."usersData" u
    left join public.student_enrollments e
      on e.user_profile_id = u.id and e.academic_year_id = ay.id
    left join public."usersData" ve on ve.id = e.validated_by
    left join public.enrollment_change_requests r
      on r.user_profile_id = u.id and r.academic_year_id = ay.id and r.status = 'pending'
    left join public."usersData" rb on rb.id = r.requested_by
    where u.id = p_profile_id
  ) x;
  return result;
end $$;
revoke all on function public.lirc_student_validation_history(bigint)
  from public, anon;
grant execute on function public.lirc_student_validation_history(bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- Self-check: a manual anchor must advance exactly one level per school year.
-- Uses a temporary unverified record (no auth needed) and removes it again;
-- silently skips when no suitable student/year pair exists.
-- ---------------------------------------------------------------------------
do $$
declare
  v_student bigint;
  y1 record;
  y2 record;
  got smallint;
  expected smallint;
  anchor integer := 2;
begin
  select ay.id, ay.start_year into y1
  from public.academic_years ay
  order by ay.start_year
  limit 1;
  if y1.id is null then
    return;
  end if;
  select ay.id, ay.start_year into y2
  from public.academic_years ay
  where ay.start_year = y1.start_year + 1
  limit 1;
  if y2.id is null then
    return;
  end if;
  select u.id into v_student
  from public."usersData" u
  where u.role = 'student'
    and not exists (
      select 1 from public.student_enrollments e
      where e.user_profile_id = u.id
        and e.academic_year_id in (y1.id, y2.id))
  limit 1;
  if v_student is null then
    return;
  end if;

  -- The probe year can be a past year; allow this record for the check only.
  perform set_config('lirc.approved_change', 'on', true);
  insert into public.student_enrollments
    (user_profile_id, academic_year_id, status, year_level, year_level_source)
  values
    (v_student, y1.id, 'unverified', anchor, 'manual');

  expected := anchor + (y2.start_year - y1.start_year);
  got := lirc_private.derived_year_level(v_student, y2.id);

  delete from public.student_enrollments
  where user_profile_id = v_student and academic_year_id = y1.id;
  perform set_config('lirc.approved_change', '', true);

  if got is distinct from expected then
    raise exception 'Year-level anchor self-check failed: expected %, got %', expected, got;
  end if;
end $$;

notify pgrst, 'reload schema';
commit;
