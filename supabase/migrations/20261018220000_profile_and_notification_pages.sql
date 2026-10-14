-- ============================================================================
-- Notification page + profile page support.
--
-- 1. lirc_notification_feed gains p_limit / p_offset, returns total and
--    has_more — the bell keeps calling it (defaults), the new page pages
--    through everything.
-- 2. lirc_my_profile() — the caller's own basic information with the
--    department / program / position names and the sign-in email, for the
--    profile page (any role).
-- ============================================================================
begin;

drop function if exists public.lirc_notification_feed();

create or replace function public.lirc_notification_feed(
  p_limit integer default 20,
  p_offset integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile bigint;
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_total bigint;
  result jsonb;
begin
  v_profile := lirc_private.my_profile_id();
  if v_profile is null then
    raise exception 'No library profile for this account.' using errcode = '42501';
  end if;
  select count(*) into v_total
  from public.notifications n
  where n.user_profile_id = v_profile;
  select jsonb_build_object(
    'total', v_total,
    'has_more', (v_offset + v_limit) < v_total,
    'unread', (select count(*) from public.notifications n
                where n.user_profile_id = v_profile and n.read_at is null),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'type', i.type, 'title', i.title, 'message', i.message,
        'link', i.link, 'read_at', i.read_at, 'created_at', i.created_at)
        order by i.created_at desc, i.id desc)
      from (
        select n.* from public.notifications n
        where n.user_profile_id = v_profile
        order by n.created_at desc, n.id desc
        limit v_limit offset v_offset
      ) i), '[]'::jsonb))
  into result;
  return result;
end $$;
revoke all on function public.lirc_notification_feed(integer, integer)
  from public, anon;
grant execute on function public.lirc_notification_feed(integer, integer)
  to authenticated;

create or replace function public.lirc_my_profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me bigint := lirc_private.my_profile_id();
  u public."usersData"%ROWTYPE;
begin
  if v_me is null then
    raise exception 'No library profile for this account.' using errcode = '42501';
  end if;
  select * into u from public."usersData" where id = v_me;
  return jsonb_build_object(
    'id', u.id,
    'full_name', concat_ws(' ', u.first_name, u.middle_initial, u.surname, u.suffix),
    'first_name', u.first_name,
    'middle_initial', u.middle_initial,
    'surname', u.surname,
    'suffix', u.suffix,
    'library_id', u.library_id,
    'role', u.role,
    'department', (select d.name from public.departments d where d.id = u.department_id),
    'program', (select p.name from public.programs p where p.id = u.program_id),
    'position', (select pc.name from public.position_classifications pc
                  where pc.id = u.position_classification_id),
    'email', (select au.email from auth.users au where au.id = u.user_id));
end $$;
revoke all on function public.lirc_my_profile() from public, anon;
grant execute on function public.lirc_my_profile() to authenticated;

notify pgrst, 'reload schema';
commit;
