-- ============================================================================
-- Roles follow-up: staff can work the Attendance desk; adding members is
-- admin-only; sign-in history can be paged.
--
-- 1. lirc_private.validation_staff_id() — librarian/admin (the validation
--    authority). lirc_private.attendance_staff_id() is widened to include
--    staff, so staff can scan cards, record time-in/out and read attendance.
-- 2. The validation family (enrollment report, validation history, change
--    requests, semester activation, the enrollment trigger and its RLS
--    policies) moves onto validation_staff_id so staff cannot validate.
-- 3. lirc_add_user / lirc_check_user_import / lirc_import_users: admin only.
-- 4. lirc_sign_in_activity gains p_offset + has_more for paging.
--
-- Live definitions are patched in place so the activity prologues stay.
-- ============================================================================
begin;

-- 1) role helpers ----------------------------------------------------------
create or replace function lirc_private.validation_staff_id()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select u.id from public."usersData" u
  where u.user_id = (select auth.uid())
    and lower(btrim(u.role::text)) in ('admin', 'librarian')
  limit 1;
$$;
revoke all on function lirc_private.validation_staff_id()
  from public, anon, authenticated;

create or replace function lirc_private.attendance_staff_id()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select u.id from public."usersData" u
  where u.user_id = (select auth.uid())
    and lower(btrim(u.role::text)) in ('staff', 'librarian', 'admin')
  limit 1;
$$;
revoke all on function lirc_private.attendance_staff_id()
  from public, anon, authenticated;

-- 2 + 3) live-definition patches -------------------------------------------
do $$
declare
  v_def text;
  v_new text;
  v_fn text;
begin
  -- 2) validation family → validation_staff_id
  foreach v_fn in array array[
    'lirc_annual_enrollment_report',
    'lirc_student_validation_history',
    'lirc_request_enrollment_change',
    'set_active_semester'
  ] loop
    select pg_get_functiondef(p.oid) into v_def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = v_fn;
    if v_def is null then
      raise exception 'public.% was not found.', v_fn;
    end if;
    if position('validation_staff_id' in v_def) = 0 then
      v_new := replace(v_def,
        'lirc_private.attendance_staff_id', 'lirc_private.validation_staff_id');
      if position('validation_staff_id' in v_new) = 0 then
        raise exception 'attendance_staff_id not found in public.%.', v_fn;
      end if;
      v_new := replace(v_new,
        'Staff access required.', 'Librarian access required.');
      execute v_new;
    end if;
  end loop;

  -- the enrollment write trigger keeps its librarian/admin rule
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'lirc_private' and p.proname = 'guard_student_enrollment';
  if v_def is null then
    raise exception 'lirc_private.guard_student_enrollment was not found.';
  end if;
  if position('validation_staff_id' in v_def) = 0 then
    v_new := replace(v_def,
      'lirc_private.attendance_staff_id', 'lirc_private.validation_staff_id');
    execute v_new;
  end if;

  -- the attendance trigger now names staff too
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'lirc_private' and p.proname = 'guard_attendance';
  if v_def is null then
    raise exception 'lirc_private.guard_attendance was not found.';
  end if;
  if position('staff, librarian or admin' in v_def) = 0 then
    v_new := replace(v_def,
      'Only a signed-in admin or librarian can record attendance.',
      'Only a signed-in staff, librarian or admin can record attendance.');
    execute v_new;
  end if;

  -- 3) adding members is admin-only
  foreach v_fn in array array[
    'lirc_add_user', 'lirc_check_user_import', 'lirc_import_users'
  ] loop
    select pg_get_functiondef(p.oid) into v_def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = v_fn;
    if v_def is null then
      raise exception 'public.% was not found.', v_fn;
    end if;
    if position('Only an admin can add members' in v_def) = 0 then
      v_new := replace(v_def,
        '  v_operator := lirc_private.library_operator_id();',
        E'  if not lirc_private.is_admin() then\n    raise exception ''Only an admin can add members.'' using errcode = ''42501'';\n  end if;\n  v_operator := lirc_private.library_operator_id();');
      if position('Only an admin can add members' in v_new) = 0 then
        raise exception 'operator check not found in public.%.', v_fn;
      end if;
      execute v_new;
    end if;
  end loop;
end $$;

-- enrollment RLS follows the validation authority --------------------------
alter policy enrollment_insert on public.student_enrollments
  with check (lirc_private.validation_staff_id() is not null);
alter policy enrollment_read on public.student_enrollments
  using (lirc_private.validation_staff_id() is not null);
alter policy enrollment_update on public.student_enrollments
  using (lirc_private.validation_staff_id() is not null)
  with check (lirc_private.validation_staff_id() is not null);

-- 4) sign-in history paging -------------------------------------------------
drop function if exists public.lirc_sign_in_activity(text, integer);

create or replace function public.lirc_sign_in_activity(
  p_scope text default 'own',
  p_page_size integer default 10,
  p_offset integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me bigint := lirc_private.my_profile_id();
  v_uid uuid;
  v_scope text := lower(btrim(coalesce(p_scope, 'own')));
  v_limit integer := least(greatest(coalesce(p_page_size, 10), 1), 50);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_audit_rows integer;
  v_rows jsonb;
  v_source text;
  v_total bigint;
  v_first timestamptz;
  v_last timestamptz;
begin
  if v_me is null then
    raise exception 'No library profile for this account.' using errcode = '42501';
  end if;
  if v_scope not in ('own', 'all') then
    raise exception 'Unknown scope.';
  end if;
  if v_scope = 'all' and not lirc_private.is_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  select u.user_id into v_uid from public."usersData" u where u.id = v_me;

  select count(*) into v_audit_rows
  from auth.audit_log_entries al
  where al.payload ->> 'action' in ('login', 'logout')
    and (v_scope = 'all' or al.payload ->> 'actor_id' = v_uid::text);

  if v_audit_rows > 0 then
    v_source := 'audit';
    select count(*), min(al.created_at), max(al.created_at)
      into v_total, v_first, v_last
    from auth.audit_log_entries al
    where al.payload ->> 'action' in ('login', 'logout')
      and (v_scope = 'all' or al.payload ->> 'actor_id' = v_uid::text);
    select coalesce(jsonb_agg(jsonb_build_object(
      'occurred_at', x.created_at,
      'action', case x.act when 'login' then 'Signed in'
                           when 'logout' then 'Signed out'
                           else x.act end,
      'actor_profile_id', u.id,
      'actor_name', concat_ws(' ', u.surname || ',', u.first_name,
                              u.middle_initial, u.suffix),
      'actor_role', u.role,
      'detail', x.actor_name)
      order by x.created_at desc), '[]'::jsonb)
    into v_rows
    from (
      select al.created_at,
             al.payload ->> 'action' as act,
             al.payload ->> 'actor_username' as actor_name,
             al.payload ->> 'actor_id' as actor_id
      from auth.audit_log_entries al
      where al.payload ->> 'action' in ('login', 'logout')
        and (v_scope = 'all' or al.payload ->> 'actor_id' = v_uid::text)
      order by al.created_at desc
      limit v_limit offset v_offset
    ) x
    left join public."usersData" u on u.user_id::text = x.actor_id;
  else
    v_source := 'sessions';
    select count(*), min(s.created_at), max(s.created_at)
      into v_total, v_first, v_last
    from auth.sessions s
    where v_scope = 'all' or s.user_id = v_uid;
    select coalesce(jsonb_agg(jsonb_build_object(
      'occurred_at', x.created_at,
      'action', 'Session started',
      'actor_profile_id', u.id,
      'actor_name', concat_ws(' ', u.surname || ',', u.first_name,
                              u.middle_initial, u.suffix),
      'actor_role', u.role,
      'detail', x.user_agent)
      order by x.created_at desc), '[]'::jsonb)
    into v_rows
    from (
      select s.created_at, s.user_id, s.user_agent
      from auth.sessions s
      where v_scope = 'all' or s.user_id = v_uid
      order by s.created_at desc
      limit v_limit offset v_offset
    ) x
    left join public."usersData" u on u.user_id = x.user_id;
  end if;

  return jsonb_build_object(
    'source', v_source,
    'scope', v_scope,
    'rows', v_rows,
    'total', coalesce(v_total, 0),
    'offset', v_offset,
    'has_more', (v_offset + v_limit) < coalesce(v_total, 0),
    'coverage_first', v_first,
    'coverage_last', v_last,
    'note', case
      when v_source = 'audit'
        then 'From the Supabase auth audit log (logins and logouts).'
      else 'From session records only — sign-outs and denied attempts appear once "Write audit logs to the database" is enabled in the Supabase dashboard.'
    end);
end $$;
revoke all on function public.lirc_sign_in_activity(text, integer, integer)
  from public, anon;
grant execute on function public.lirc_sign_in_activity(text, integer, integer)
  to authenticated;

notify pgrst, 'reload schema';
commit;
