-- ============================================================================
-- Validation change requests: deep links + the tabs behind them.
--
-- 1. Request / result notifications now link to /enrollments?request=<id> so
--    clicking the bell can open the approval window for that exact request.
--    (Patched on the LIVE definitions so the activity prologues stay intact.)
-- 2. lirc_enrollment_requests(p_only_mine) — the Pending / Approved /
--    Rejected tabs (admins see every request, librarians their own).
-- 3. lirc_enrollment_request_detail(id) — student, school year and current
--    record for one request, so the validation window can open from a link.
-- ============================================================================
begin;

do $$
declare
  v_def text;
  v_new text;
begin
  -- 1a) the request notification: include the new request id in the link
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'lirc_request_enrollment_change';
  if v_def is null then
    raise exception 'public.lirc_request_enrollment_change was not found.';
  end if;
  if position('?request=' in v_def) = 0 then
    v_new := replace(v_def,
      '  v_previous text;',
      E'  v_previous text;\n  v_request_id bigint;');
    v_new := replace(v_new,
      '(p_profile_id, p_academic_year_id, p_status, v_previous, v_staff);',
      E'(p_profile_id, p_academic_year_id, p_status, v_previous, v_staff)\n    returning id into v_request_id;');
    v_new := replace(v_new,
      $p$'/enrollments');$p$,
      $r$'/enrollments?request=' || v_request_id);$r$);
    if position('returning id into v_request_id' in v_new) = 0
       or position('?request=' in v_new) = 0 then
      raise exception 'Expected patterns not found in lirc_request_enrollment_change.';
    end if;
    execute v_new;
  end if;

  -- 1b) the result notification: the requester can open the same window
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'lirc_review_enrollment_change';
  if v_def is null then
    raise exception 'public.lirc_review_enrollment_change was not found.';
  end if;
  if position('?request=' in v_def) = 0 then
    v_new := replace(v_def,
      $p$'/enrollments');$p$,
      $r$'/enrollments?request=' || p_request_id);$r$);
    if position('?request=' in v_new) = 0 then
      raise exception 'Expected link not found in lirc_review_enrollment_change.';
    end if;
    execute v_new;
  end if;
end $$;

-- 2) the request tabs ------------------------------------------------------
create or replace function public.lirc_enrollment_requests(
  p_only_mine boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_operator bigint;
  result jsonb;
begin
  v_operator := lirc_private.library_operator_id();
  if v_operator is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  if not p_only_mine and not lirc_private.is_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  select jsonb_build_object('requests', coalesce(jsonb_agg(jsonb_build_object(
      'id', x.id,
      'student', x.student,
      'student_card', x.student_card,
      'year_name', x.year_name,
      'requested_status', x.requested_status,
      'previous_status', x.previous_status,
      'requested_by', x.requested_by,
      'status', x.status,
      'reviewed_by', x.reviewed_by,
      'reviewed_at', x.reviewed_at,
      'created_at', x.created_at
    ) order by x.created_at desc, x.id desc), '[]'::jsonb))
  into result
  from (
    select r.id,
      concat_ws(' ', u.first_name, u.middle_initial, u.surname, u.suffix) as student,
      u.library_id as student_card,
      ay.name as year_name,
      r.requested_status, r.previous_status,
      concat_ws(' ', rb.first_name, rb.surname) as requested_by,
      r.status,
      nullif(concat_ws(' ', rv.first_name, rv.surname), '') as reviewed_by,
      r.reviewed_at, r.created_at
    from public.enrollment_change_requests r
    join public."usersData" u on u.id = r.user_profile_id
    join public.academic_years ay on ay.id = r.academic_year_id
    join public."usersData" rb on rb.id = r.requested_by
    left join public."usersData" rv on rv.id = r.reviewed_by
    where not p_only_mine or r.requested_by = v_operator
    order by r.created_at desc, r.id desc
    limit 100
  ) x;
  return result;
end $$;

-- 3) one request's student, year and current record ------------------------
create or replace function public.lirc_enrollment_request_detail(
  p_request_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r record;
  u record;
  v_year jsonb;
  v_enrollment jsonb;
begin
  if lirc_private.library_operator_id() is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  select * into r from public.enrollment_change_requests
   where id = p_request_id;
  if not found then raise exception 'Request not found.'; end if;
  select * into u from public."usersData" where id = r.user_profile_id;
  select jsonb_build_object('id', ay.id, 'name', ay.name)
    into v_year
    from public.academic_years ay where ay.id = r.academic_year_id;
  select jsonb_build_object(
      'id', e.id,
      'status', e.status,
      'year_level', e.year_level,
      'year_level_note', e.year_level_note,
      'validated_at', e.validated_at,
      'validation_reference', e.validation_reference)
    into v_enrollment
    from public.student_enrollments e
    where e.user_profile_id = r.user_profile_id
      and e.academic_year_id = r.academic_year_id;
  return jsonb_build_object(
    'request', jsonb_build_object(
      'id', r.id,
      'status', r.status,
      'requested_status', r.requested_status,
      'previous_status', r.previous_status,
      'created_at', r.created_at),
    'profile', jsonb_build_object(
      'id', u.id,
      'first_name', u.first_name,
      'middle_initial', u.middle_initial,
      'surname', u.surname,
      'suffix', u.suffix,
      'full_name', concat_ws(' ', u.first_name, u.middle_initial, u.surname, u.suffix),
      'library_id', u.library_id,
      'role', u.role),
    'year', v_year,
    'enrollment', v_enrollment);
end $$;

revoke all on function
  public.lirc_enrollment_requests(boolean),
  public.lirc_enrollment_request_detail(bigint)
  from public, anon;
grant execute on function
  public.lirc_enrollment_requests(boolean),
  public.lirc_enrollment_request_detail(bigint)
  to authenticated;

-- Notifications already sitting in the bell for still-pending requests get
-- the deep link too (request + notification share one transaction's now()).
update public.notifications n
   set link = '/enrollments?request=' || r.id
  from public.enrollment_change_requests r
 where n.type = 'approval_request'
   and n.link = '/enrollments'
   and r.status = 'pending'
   and abs(extract(epoch from (r.created_at - n.created_at))) < 2;

notify pgrst, 'reload schema';
commit;
