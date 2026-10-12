-- System-computed year levels for annual validation.
--
-- Staff no longer type a year level. The database computes it:
--   base  = academic-year start − (2000 + card YY) + 1
--   level = base − previous leave-of-absence years, when that is 1–4
--
-- Examples (card 23-…, academic year starting 2026): base = 4.
--   no leave years      -> 4th year
--   one leave year      -> 3rd year
--   two leave years     -> 2nd year
--
-- Saving "enrolled" when the computation is already past four years raises
-- a clear error so staff record graduated, withdrawn or on leave instead.
-- The old reference / explanation fields stay in the table for older rows
-- but are no longer required or written by the annual validation form.
begin;

create or replace function lirc_private.derived_year_level(
  p_profile bigint,
  p_year bigint
)
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  with target as (
    select
      u.id as profile_id,
      case
        when u.library_id ~ '^[0-9]{2}-'
        then 2000 + substring(u.library_id from 1 for 2)::integer
      end as admission_year,
      ay.start_year
    from public."usersData" u
    join public.academic_years ay on ay.id = p_year
    where u.id = p_profile
  ),
  counted as (
    select
      t.start_year - t.admission_year + 1
        - (select count(*)
             from public.student_enrollments e2
             join public.academic_years ay2 on ay2.id = e2.academic_year_id
            where e2.user_profile_id = t.profile_id
              and e2.status = 'leave_of_absence'
              and ay2.start_year >= t.admission_year
              and ay2.start_year < t.start_year) as level
    from target t
    where t.admission_year is not null
  )
  select case when level between 1 and 4 then level::smallint else null end
  from counted;
$$;
revoke all on function lirc_private.derived_year_level(bigint, bigint) from public, anon, authenticated;

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
  staff := lirc_private.attendance_staff_id();
  if staff is null then
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

  -- The status is the only thing staff choose; the system derives the level.
  if NEW.status = 'unverified' then
    NEW.validated_at := null;
    NEW.validated_by := null;
    NEW.year_level := null;
    NEW.year_level_note := null;
    NEW.validation_reference := null;
  else
    NEW.validated_at := now();
    NEW.validated_by := staff;
    NEW.year_level := lirc_private.derived_year_level(NEW.user_profile_id, NEW.academic_year_id);
    if NEW.status = 'enrolled' and NEW.year_level is null then
      raise exception 'The card year is past four years of study. Record the student as graduated, withdrawn or on leave instead.';
    end if;
  end if;
  NEW.updated_at := now();
  return NEW;
end;
$$;

-- Self-check against a real enrollment with no leave years: the derived
-- level must equal the card-only computation. Fails safely (rolls back).
do $$
declare
  probe record;
  expected smallint;
begin
  select u.id as profile_id, ay.id as year_id, u.library_id, ay.start_year
    into probe
  from public.student_enrollments e
  join public."usersData" u on u.id = e.user_profile_id
  join public.academic_years ay on ay.id = e.academic_year_id
  where e.status = 'enrolled'
    and u.library_id ~ '^[0-9]{2}-'
    and not exists (
      select 1
      from public.student_enrollments l
      join public.academic_years la on la.id = l.academic_year_id
      where l.user_profile_id = u.id
        and l.status = 'leave_of_absence'
        and la.start_year < ay.start_year
    )
  order by e.id
  limit 1;
  if not found then
    raise notice 'No suitable enrollment found for the derived-level self-check; skipping.';
    return;
  end if;
  expected := case
    when probe.start_year - (2000 + substring(probe.library_id from 1 for 2)::integer) + 1 between 1 and 4
    then (probe.start_year - (2000 + substring(probe.library_id from 1 for 2)::integer) + 1)::smallint
    else null
  end;
  if lirc_private.derived_year_level(probe.profile_id, probe.year_id) is distinct from expected then
    raise exception 'Derived-level self-check failed for profile % / year %.', probe.profile_id, probe.year_id;
  end if;
  raise notice 'Derived-level self-check passed (profile %).', probe.profile_id;
end $$;

notify pgrst, 'reload schema';
commit;
