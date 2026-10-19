-- Acquisition rows gain their curriculum placements: which department and
-- program each suggested subject belongs to (course code -> curriculum
-- subjects -> entries -> programs). A shared subject can map to several
-- programs, so the field is an array of { department, program } pairs.
-- ============================================================================
begin;

create or replace function public.lirc_acquisition_list(p_status text default 'pending')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_status text := lower(btrim(coalesce(p_status, 'pending')));
begin
  if lirc_private.library_operator_id() is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  if v_status not in ('pending', 'approved', 'rejected', 'all') then
    raise exception 'Invalid status.';
  end if;
  return jsonb_build_object(
    'pending', (
      select count(*) from public.acquisition_suggestions where status = 'pending'),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'course_code', a.course_code,
        'title', a.title,
        'author', a.author,
        'note', a.note,
        'source', a.source,
        'status', a.status,
        'created_at', a.created_at,
        'reviewed_at', a.reviewed_at,
        'review_note', a.review_note,
        'suggested_by_name', (
          select btrim(u.first_name || ' ' || u.surname)
          from public."usersData" u where u.id = a.suggested_by),
        'reviewed_by_name', (
          select btrim(u.first_name || ' ' || u.surname)
          from public."usersData" u where u.id = a.reviewed_by),
        'placements', (
          select coalesce(jsonb_agg(jsonb_build_object(
              'department', x.department,
              'program', x.program)
              order by x.department, x.program), '[]'::jsonb)
          from (
            select distinct
                   coalesce(cp.department, 'No department recorded') as department,
                   cp.code as program
            from public.curriculum_subjects cs
            join public.curriculum_entries ce on ce.subject_id = cs.id
            join public.curriculum_programs cp
              on cp.id = ce.curriculum_program_id
            where a.course_code is not null
              and upper(btrim(cs.course_code)) = upper(btrim(a.course_code))
          ) x))
        order by a.created_at desc)
      from public.acquisition_suggestions a
      where v_status = 'all' or a.status = v_status), '[]'::jsonb));
end;
$$;

revoke all on function public.lirc_acquisition_list(text)
  from public, anon, authenticated;
grant execute on function public.lirc_acquisition_list(text) to authenticated;

notify pgrst, 'reload schema';
commit;
