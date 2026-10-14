-- ============================================================================
-- One-call attendance export: the Excel report reads every filtered visit in
-- a single request instead of ~100 paged calls. Same rows as the on-screen
-- report (it reuses lirc_private.filtered_attendance with the same filters).
-- ============================================================================
begin;

create or replace function public.lirc_attendance_export(
  p_semester_id bigint,
  p_filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rows jsonb;
begin
  if lirc_private.attendance_staff_id() is null then
    raise exception 'Staff access required.' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(r), '[]'::jsonb) into v_rows
  from lirc_private.filtered_attendance(
         p_semester_id, coalesce(p_filters, '{}'::jsonb), false) r;
  return jsonb_build_object('rows', v_rows, 'as_of', now());
end $$;
revoke all on function public.lirc_attendance_export(bigint, jsonb)
  from public, anon;
grant execute on function public.lirc_attendance_export(bigint, jsonb)
  to authenticated;

notify pgrst, 'reload schema';
commit;
