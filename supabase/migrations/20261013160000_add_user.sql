-- Add User: staff add one member (Individual) or many (Bulk CSV).
--
-- Rules (shared by both methods):
--   * library_id, first name and surname are required; the library ID must be
--     new (case-insensitive). Middle initial and suffix may be blank.
--   * Role must be one of the six roles; only an admin can add another admin.
--   * Department / program / position classification IDs must exist.
--   * Students may get one annual enrollment row (Unverified by default).
--     A year level typed at creation counts as manual and is kept (irregular
--     or continuing students); without one, the level is derived from the
--     library card when the enrollment is validated.
--   * Unverified enrollment rows may be created by any library operator;
--     validating still requires a signed-in admin or librarian.
begin;

-- Where a stored year level came from: 'manual' (typed at creation) or
-- 'derived' (computed from the library card at validation).
alter table public.student_enrollments add column if not exists year_level_source text;
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.student_enrollments'::regclass
      and conname = 'student_enrollments_level_source_check'
  ) then
    alter table public.student_enrollments
      add constraint student_enrollments_level_source_check
      check (year_level_source is null or year_level_source in ('manual', 'derived'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Enrollment guard: keep manual levels, allow unverified rows for operators
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

  -- A level typed when the record is created counts as manual (irregular or
  -- continuing students).
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
      -- Keep the manually entered level (irregular students).
      null;
    else
      NEW.year_level := lirc_private.derived_year_level(NEW.user_profile_id, NEW.academic_year_id);
      NEW.year_level_source := 'derived';
      if NEW.status = 'enrolled' and NEW.year_level is null then
        raise exception 'The card year is past four years of study. Record the student as graduated, withdrawn or on leave instead.';
      end if;
    end if;
  end if;
  NEW.updated_at := now();
  return NEW;
end;
$$;

-- ---------------------------------------------------------------------------
-- Internal: validate the member fields (shared by both methods)
-- ---------------------------------------------------------------------------
create or replace function lirc_private.clean_new_member(p_profile jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_card text;
  v_first text;
  v_last text;
  v_mi text;
  v_suffix text;
  v_role text;
  v_department text;
  v_program text;
  v_position text;
begin
  if p_profile is null or jsonb_typeof(p_profile) <> 'object' then
    raise exception 'Invalid member details.';
  end if;

  v_card := btrim(coalesce(p_profile->>'library_id', ''));
  if v_card = '' then raise exception 'Library ID is required.'; end if;
  if char_length(v_card) > 120 then
    raise exception 'Library ID must be 120 characters or fewer.';
  end if;

  v_first := btrim(coalesce(p_profile->>'first_name', ''));
  if v_first = '' then raise exception 'First name is required.'; end if;
  if char_length(v_first) > 100 then
    raise exception 'First name must be 100 characters or fewer.';
  end if;

  v_last := btrim(coalesce(p_profile->>'surname', ''));
  if v_last = '' then raise exception 'Surname is required.'; end if;
  if char_length(v_last) > 100 then
    raise exception 'Surname must be 100 characters or fewer.';
  end if;

  v_mi := nullif(btrim(coalesce(p_profile->>'middle_initial', '')), '');
  if v_mi is not null and char_length(v_mi) > 2 then
    raise exception 'Middle initial must be 2 characters or fewer.';
  end if;

  v_suffix := nullif(btrim(coalesce(p_profile->>'suffix', '')), '');
  if v_suffix is not null and char_length(v_suffix) > 20 then
    raise exception 'Suffix must be 20 characters or fewer.';
  end if;

  v_role := lower(btrim(coalesce(p_profile->>'role', '')));
  if v_role not in ('student', 'faculty', 'staff', 'non_teaching_personnel', 'librarian', 'admin') then
    raise exception 'Choose a valid role.';
  end if;
  if v_role = 'admin' and not lirc_private.is_admin() then
    raise exception 'Only an admin can add another admin.';
  end if;

  v_department := nullif(btrim(coalesce(p_profile->>'department_id', '')), '');
  if v_department is not null and (
    v_department !~ '^[1-9][0-9]*$'
    or not exists (select 1 from public.departments d where d.id = v_department::bigint)
  ) then
    raise exception 'Department ID % does not exist.', v_department;
  end if;

  v_program := nullif(btrim(coalesce(p_profile->>'program_id', '')), '');
  if v_program is not null and (
    v_program !~ '^[1-9][0-9]*$'
    or not exists (select 1 from public.programs p where p.id = v_program::bigint)
  ) then
    raise exception 'Program ID % does not exist.', v_program;
  end if;

  v_position := nullif(btrim(coalesce(p_profile->>'position_classification_id', '')), '');
  if v_position is not null and (
    v_position !~ '^[1-9][0-9]*$'
    or not exists (select 1 from public.position_classifications pc where pc.id = v_position::bigint)
  ) then
    raise exception 'Position classification ID % does not exist.', v_position;
  end if;

  return jsonb_build_object(
    'library_id', v_card,
    'first_name', v_first,
    'surname', v_last,
    'middle_initial', v_mi,
    'suffix', v_suffix,
    'role', v_role,
    'department_id', case when v_department is null then null else v_department::bigint end,
    'program_id', case when v_program is null then null else v_program::bigint end,
    'position_classification_id', case when v_position is null then null else v_position::bigint end);
end $$;
revoke all on function lirc_private.clean_new_member(jsonb)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Internal: validate the optional annual enrollment of a new student
-- ---------------------------------------------------------------------------
create or replace function lirc_private.clean_new_enrollment(
  p_enrollment jsonb,
  p_year_id bigint,
  p_status text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_year bigint;
  v_level text;
  v_note text;
  v_status text;
begin
  v_year := p_year_id;
  if v_year is null then
    raise exception 'Select the academic year for student rows.';
  end if;
  if not exists (select 1 from public.academic_years ay where ay.id = v_year) then
    raise exception 'The selected academic year does not exist.';
  end if;

  v_status := lower(btrim(coalesce(p_status, 'unverified')));
  if v_status not in ('unverified', 'enrolled') then
    raise exception 'Choose Unverified or Validate now.';
  end if;

  v_level := nullif(btrim(coalesce(p_enrollment->>'year_level', '')), '');
  if v_level is not null and v_level !~ '^[1-4]$' then
    raise exception 'Year level must be between 1 and 4.';
  end if;

  v_note := nullif(btrim(coalesce(p_enrollment->>'year_level_note', '')), '');
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'The year level note must be 500 characters or fewer.';
  end if;

  return jsonb_build_object(
    'academic_year_id', v_year,
    'status', v_status,
    'year_level', case when v_level is null then null else v_level::smallint end,
    'year_level_note', v_note,
    'year_level_source', case when v_level is null then null else 'manual' end);
end $$;
revoke all on function lirc_private.clean_new_enrollment(jsonb, bigint, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Internal: validate one CSV row (used by the preview and the import)
-- ---------------------------------------------------------------------------
create or replace function lirc_private.prepare_user_row(
  p_item jsonb,
  p_year_id bigint,
  p_seen text[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile jsonb;
  v_key text;
  v_enrollment jsonb := null;
begin
  if p_item is null or jsonb_typeof(p_item) <> 'object' then
    raise exception 'Invalid row.';
  end if;
  v_profile := lirc_private.clean_new_member(p_item);
  v_key := lower(v_profile->>'library_id');
  if v_key = any (p_seen) then
    raise exception 'This library ID appears twice in the file.';
  end if;
  if exists (select 1 from public."usersData" u where lower(u.library_id) = v_key) then
    raise exception 'This library ID already belongs to a user.';
  end if;

  if v_profile->>'role' = 'student' then
    v_enrollment := lirc_private.clean_new_enrollment(p_item, p_year_id, 'unverified');
  end if;

  return jsonb_build_object(
    'key', v_key,
    'profile', v_profile,
    'enrollment', v_enrollment);
end $$;
revoke all on function lirc_private.prepare_user_row(jsonb, bigint, text[])
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: add one member (and, for a student, one annual enrollment row)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_add_user(
  p_profile jsonb,
  p_enrollment jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operator bigint;
  v_clean jsonb;
  v_profile_id bigint;
  v_dupe text;
  v_enrollment jsonb;
  v_year bigint;
  v_level text;
begin
  v_operator := lirc_private.library_operator_id();
  if v_operator is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;

  v_clean := lirc_private.clean_new_member(p_profile);

  select u.library_id into v_dupe
  from public."usersData" u
  where lower(u.library_id) = lower(v_clean->>'library_id')
  limit 1;
  if v_dupe is not null then
    raise exception 'This library ID already belongs to a user.';
  end if;

  begin
    insert into public."usersData"
      (library_id, first_name, surname, middle_initial, suffix, role,
       department_id, program_id, position_classification_id)
    values
      (v_clean->>'library_id',
       v_clean->>'first_name',
       v_clean->>'surname',
       v_clean->>'middle_initial',
       v_clean->>'suffix',
       v_clean->>'role',
       (v_clean->>'department_id')::bigint,
       (v_clean->>'program_id')::bigint,
       (v_clean->>'position_classification_id')::bigint)
    returning id into v_profile_id;
  exception when unique_violation then
    raise exception 'This library ID already belongs to a user.';
  end;

  -- A student may get one annual enrollment row with the profile.
  if v_clean->>'role' = 'student'
     and p_enrollment is not null
     and jsonb_typeof(p_enrollment) = 'object' then
    v_year := nullif(btrim(coalesce(p_enrollment->>'academic_year_id', '')), '');
    if v_year is null or v_year !~ '^[1-9][0-9]*$' then
      raise exception 'Choose a valid academic year.';
    end if;
    v_level := nullif(btrim(coalesce(p_enrollment->>'year_level', '')), '');
    if v_level is not null and v_level !~ '^[1-4]$' then
      raise exception 'Year level must be between 1 and 4.';
    end if;
    v_enrollment := lirc_private.clean_new_enrollment(
      p_enrollment, v_year::bigint, coalesce(p_enrollment->>'status', 'unverified'));

    insert into public.student_enrollments
      (user_profile_id, academic_year_id, status, year_level,
       year_level_note, year_level_source)
    values
      (v_profile_id,
       (v_enrollment->>'academic_year_id')::bigint,
       v_enrollment->>'status',
       case when nullif(v_enrollment->>'year_level', '') is null
            then null else (v_enrollment->>'year_level')::smallint end,
       nullif(v_enrollment->>'year_level_note', ''),
       nullif(v_enrollment->>'year_level_source', ''));
  end if;

  return jsonb_build_object(
    'id', v_profile_id,
    'library_id', v_clean->>'library_id');
end $$;

-- ---------------------------------------------------------------------------
-- RPC: check a whole CSV file first (no saving)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_check_user_import(
  p_rows jsonb,
  p_year_id bigint default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_operator bigint;
  item jsonb;
  v_index int := 0;
  v_row_no int;
  v_prepared jsonb;
  v_seen text[] := '{}';
  v_ok int := 0;
  v_problems int := 0;
  v_results jsonb := '[]'::jsonb;
begin
  v_operator := lirc_private.library_operator_id();
  if v_operator is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'Add at least one row.';
  end if;
  if jsonb_array_length(p_rows) > 500 then
    raise exception 'At most 500 rows can be checked at once.';
  end if;

  for item in select value from jsonb_array_elements(p_rows) loop
    v_index := v_index + 1;
    v_row_no := v_index;
    begin
      if item is not null and jsonb_typeof(item) = 'object' then
        v_row_no := coalesce((item->>'row')::int, v_index);
      end if;
      v_prepared := lirc_private.prepare_user_row(item, p_year_id, v_seen);
      v_seen := v_seen || (v_prepared->>'key');
      v_ok := v_ok + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'row', v_row_no,
        'library_id', v_prepared->'profile'->>'library_id',
        'ok', true));
    exception when others then
      v_problems := v_problems + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'row', v_row_no,
        'library_id', case when item is not null and jsonb_typeof(item) = 'object'
                      then btrim(coalesce(item->>'library_id', '')) else '' end,
        'ok', false,
        'reason', sqlerrm));
    end;
  end loop;

  return jsonb_build_object(
    'valid', v_ok,
    'problems', v_problems,
    'results', v_results);
end $$;

-- ---------------------------------------------------------------------------
-- RPC: import the checked rows (re-checks everything before saving)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_import_users(
  p_rows jsonb,
  p_year_id bigint default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operator bigint;
  item jsonb;
  v_index int := 0;
  v_row_no int;
  v_prepared jsonb;
  v_enrollment jsonb;
  v_profile_id bigint;
  v_seen text[] := '{}';
  v_added int := 0;
  v_failed int := 0;
  v_results jsonb := '[]'::jsonb;
begin
  v_operator := lirc_private.library_operator_id();
  if v_operator is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'Add at least one row.';
  end if;
  if jsonb_array_length(p_rows) > 500 then
    raise exception 'At most 500 rows can be imported at once.';
  end if;

  for item in select value from jsonb_array_elements(p_rows) loop
    v_index := v_index + 1;
    v_row_no := v_index;
    begin
      if item is not null and jsonb_typeof(item) = 'object' then
        v_row_no := coalesce((item->>'row')::int, v_index);
      end if;
      v_prepared := lirc_private.prepare_user_row(item, p_year_id, v_seen);
      v_enrollment := v_prepared->'enrollment';

      begin
        insert into public."usersData"
          (library_id, first_name, surname, middle_initial, suffix, role,
           department_id, program_id, position_classification_id)
        values
          (v_prepared->'profile'->>'library_id',
           v_prepared->'profile'->>'first_name',
           v_prepared->'profile'->>'surname',
           v_prepared->'profile'->>'middle_initial',
           v_prepared->'profile'->>'suffix',
           v_prepared->'profile'->>'role',
           (v_prepared->'profile'->>'department_id')::bigint,
           (v_prepared->'profile'->>'program_id')::bigint,
           (v_prepared->'profile'->>'position_classification_id')::bigint)
        returning id into v_profile_id;
      exception when unique_violation then
        raise exception 'This library ID already belongs to a user.';
      end;

      if v_enrollment is not null and jsonb_typeof(v_enrollment) = 'object' then
        insert into public.student_enrollments
          (user_profile_id, academic_year_id, status, year_level,
           year_level_note, year_level_source)
        values
          (v_profile_id,
           (v_enrollment->>'academic_year_id')::bigint,
           v_enrollment->>'status',
           case when nullif(v_enrollment->>'year_level', '') is null
                then null else (v_enrollment->>'year_level')::smallint end,
           nullif(v_enrollment->>'year_level_note', ''),
           nullif(v_enrollment->>'year_level_source', ''));
      end if;

      v_seen := v_seen || (v_prepared->>'key');
      v_added := v_added + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'row', v_row_no,
        'library_id', v_prepared->'profile'->>'library_id',
        'ok', true));
    exception when others then
      v_failed := v_failed + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'row', v_row_no,
        'library_id', case when item is not null and jsonb_typeof(item) = 'object'
                      then btrim(coalesce(item->>'library_id', '')) else '' end,
        'ok', false,
        'reason', sqlerrm));
    end;
  end loop;

  return jsonb_build_object(
    'added', v_added,
    'failed', v_failed,
    'results', v_results);
end $$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function
  public.lirc_add_user(jsonb, jsonb),
  public.lirc_check_user_import(jsonb, bigint),
  public.lirc_import_users(jsonb, bigint)
  from public, anon;
grant execute on function
  public.lirc_add_user(jsonb, jsonb),
  public.lirc_check_user_import(jsonb, bigint),
  public.lirc_import_users(jsonb, bigint)
  to authenticated;

notify pgrst, 'reload schema';
commit;
