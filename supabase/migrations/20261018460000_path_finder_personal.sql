-- ============================================================================
-- Path Finder — flag the caller's own program.
--
-- The shared auth profile only carries name/role, so the server marks which
-- curriculum program belongs to the signed-in member (their exact program,
-- or the first program of their department for faculty). The page opens
-- that program first; everything else stays the same.
-- ============================================================================
begin;

create or replace function public.lirc_path_finder_programs()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me public."usersData"%ROWTYPE;
begin
  select * into v_me from public."usersData"
  where id = lirc_private.my_profile_id();

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', cp.id,
      'code', cp.code,
      'name', cp.name,
      'department', cp.department,
      'director', cp.director,
      'total_units', cp.total_units,
      'program_id', cp.program_id,
      'library_program', p.name,
      'department_id', p.department_id,
      'mine', case
        when v_me.id is null then false
        when v_me.program_id is not null then cp.program_id = v_me.program_id
        when v_me.department_id is not null then p.department_id = v_me.department_id
        else false
      end,
      'subjects', (
        select count(distinct upper(btrim(s.course_code)))
        from public.curriculum_entries e
        join public.curriculum_subjects s on s.id = e.subject_id
        where e.curriculum_program_id = cp.id),
      'covered', (
        select count(distinct upper(btrim(s.course_code)))
        from public.curriculum_entries e
        join public.curriculum_subjects s on s.id = e.subject_id
        where e.curriculum_program_id = cp.id
          and exists (
            select 1 from public.subject_recommendations r
            where r.course_code = upper(btrim(s.course_code)) and r.status = 'approved')),
      'pending', (
        select count(*) from public.subject_recommendations r
        where r.status = 'pending'
          and r.course_code in (
            select distinct upper(btrim(s.course_code))
            from public.curriculum_entries e
            join public.curriculum_subjects s on s.id = e.subject_id
            where e.curriculum_program_id = cp.id))
    ) order by cp.code), '[]'::jsonb)
    from public.curriculum_programs cp
    left join public.programs p on p.id = cp.program_id
  );
end;
$$;

revoke all on function public.lirc_path_finder_programs() from public, anon, authenticated;
grant execute on function public.lirc_path_finder_programs() to authenticated;

commit;
