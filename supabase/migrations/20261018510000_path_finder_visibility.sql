-- ============================================================================
-- Path Finder visibility hardening.
--
-- Students and faculty only ever see recommendations a librarian has
-- approved; faculty suggestions stay invisible until approved (faculty do
-- see their own pending note on the subject card). The programs list also
-- carried the pending-suggestion count to every member — operators keep it,
-- everyone else gets 0. The curriculum and suggestions RPCs already gate
-- their operator-only fields the same way.
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
  v_curator bigint := lirc_private.path_finder_curator_id();
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
      'pending', case when v_curator is null then 0 else (
        select count(*) from public.subject_recommendations r
        where r.status = 'pending'
          and r.course_code in (
            select distinct upper(btrim(s.course_code))
            from public.curriculum_entries e
            join public.curriculum_subjects s on s.id = e.subject_id
            where e.curriculum_program_id = cp.id)) end
    ) order by cp.code), '[]'::jsonb)
    from public.curriculum_programs cp
    left join public.programs p on p.id = cp.program_id
  );
end;
$$;

revoke all on function public.lirc_path_finder_programs() from public, anon, authenticated;
grant execute on function public.lirc_path_finder_programs() to authenticated;

commit;
