-- Fix: lirc_add_user validated the academic year id after casting it to
-- bigint, which fails on text input. Validate the text first, then cast.
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
  v_year_text text;
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
    v_year_text := btrim(coalesce(p_enrollment->>'academic_year_id', ''));
    if v_year_text = '' or v_year_text !~ '^[1-9][0-9]*$' then
      raise exception 'Choose a valid academic year.';
    end if;
    v_level := nullif(btrim(coalesce(p_enrollment->>'year_level', '')), '');
    if v_level is not null and v_level !~ '^[1-4]$' then
      raise exception 'Year level must be between 1 and 4.';
    end if;
    v_enrollment := lirc_private.clean_new_enrollment(
      p_enrollment,
      v_year_text::bigint,
      coalesce(p_enrollment->>'status', 'unverified'));

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

revoke all on function public.lirc_add_user(jsonb, jsonb) from public, anon;
grant execute on function public.lirc_add_user(jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
