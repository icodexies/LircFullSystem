-- ============================================================================
-- Smaller, less chatty member reads.
--
-- 1. lirc_notification_unread: the bell polls only the unread count instead of
--    downloading the full notification feed every 45 seconds.
-- 2. lirc_my_dashboard: one authenticated read for the member dashboard
--    instead of separate loan, statistics and fine requests.
--
-- Both functions are read-only, security definer, scoped to the caller's
-- profile, and executable by authenticated users only.
-- ============================================================================
begin;

create or replace function public.lirc_notification_unread()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile bigint := lirc_private.my_profile_id();
begin
  if v_profile is null then
    raise exception 'No library profile for this account.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'unread', (
      select count(*)
      from public.notifications n
      where n.user_profile_id = v_profile and n.read_at is null),
    'total', (
      select count(*)
      from public.notifications n
      where n.user_profile_id = v_profile),
    'latest_at', (
      select max(n.created_at)
      from public.notifications n
      where n.user_profile_id = v_profile));
end;
$$;

revoke all on function public.lirc_notification_unread()
  from public, anon, authenticated;
grant execute on function public.lirc_notification_unread()
  to authenticated;

create or replace function public.lirc_my_dashboard(
  p_semester_id bigint default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile bigint := lirc_private.my_profile_id();
begin
  if v_profile is null then
    raise exception 'No library profile for this account.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'open_loans', public.lirc_my_loans('open', '', 100, 0),
    'all_loans', public.lirc_my_loans('all', '', 10, 0),
    'statistics', public.lirc_my_statistics(p_semester_id),
    'fines', public.lirc_my_fines());
end;
$$;

revoke all on function public.lirc_my_dashboard(bigint)
  from public, anon, authenticated;
grant execute on function public.lirc_my_dashboard(bigint)
  to authenticated;

notify pgrst, 'reload schema';
commit;
