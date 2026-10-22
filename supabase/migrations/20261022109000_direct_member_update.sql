-- Direct member edits: staff, librarian and admin save changes immediately.
-- This replaces the old request RPC; the approval request table/functions are
-- removed in 20261022110000 after this RPC is live.
begin;

create or replace function public.lirc_update_member(
  p_profile_id bigint, p_changes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changes jsonb;
begin
  if lirc_private.library_operator_id() is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  v_changes := lirc_private.sanitize_member_changes(p_changes, p_profile_id);
  if v_changes = '{}'::jsonb then
    raise exception 'Nothing changed.';
  end if;
  -- The usersData activity trigger records the actor and the changed fields.
  perform lirc_private.apply_member_change(p_profile_id, v_changes);
  return jsonb_build_object('applied', true);
end $$;

revoke all on function public.lirc_update_member(bigint, jsonb)
  from public, anon;
grant execute on function public.lirc_update_member(bigint, jsonb)
  to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
