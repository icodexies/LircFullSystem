-- Master lists for the member edit form (departments, programs, positions).
-- Separate from the attendance filter options: those list only values already
-- in use; editing needs every configured row. Operator-guarded (staff,
-- librarian, admin) so the Users page works for every operator role.
begin;

create or replace function public.lirc_member_options()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if lirc_private.library_operator_id() is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'department', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name) order by d.name, d.id)
      from public.departments d), '[]'::jsonb),
    'program', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name) order by p.name, p.id)
      from public.programs p), '[]'::jsonb),
    'position', coalesce((
      select jsonb_agg(jsonb_build_object('id', pc.id, 'name', pc.name) order by pc.name, pc.id)
      from public.position_classifications pc), '[]'::jsonb));
end $$;

revoke all on function public.lirc_member_options() from public, anon;
grant execute on function public.lirc_member_options() to authenticated;

notify pgrst, 'reload schema';
commit;
