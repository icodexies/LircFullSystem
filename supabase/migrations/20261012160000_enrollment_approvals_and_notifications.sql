-- Enrollment approvals for past school years + generic in-app notifications.
--
-- Rules:
--   * Current school years stay a direct save for staff/librarians.
--   * A PAST school year changes only through a request: a librarian submits,
--     an admin approves or rejects. An admin's own past-year edits apply
--     immediately (they are the approver).
--   * Approving recomputes the derived year level of LATER years, so the
--     card + leave-years math always stays consistent.
--   * Every action notifies the right people through the notifications
--     table, which powers the header bell.
begin;

-- ---------------------------------------------------------------------------
-- Caller helpers
-- ---------------------------------------------------------------------------
create or replace function lirc_private.my_profile_id()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select u.id from public."usersData" u
  where u.user_id = (select auth.uid())
  limit 1;
$$;
revoke all on function lirc_private.my_profile_id() from public, anon, authenticated;

create or replace function lirc_private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public."usersData" u
    where u.user_id = (select auth.uid())
      and lower(btrim(u.role::text)) = 'admin'
  );
$$;
revoke all on function lirc_private.is_admin() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Notifications (generic; the header bell reads this)
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_profile_id bigint not null references public."usersData"(id) on delete cascade,
  type text not null default 'info',
  title text not null,
  message text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_profile_created_idx
  on public.notifications (user_profile_id, created_at desc, id desc);

alter table public.notifications enable row level security;
revoke all privileges on table public.notifications from public, anon, authenticated;
grant select on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;
grant all privileges on table public.notifications to service_role;

drop policy if exists "LIRC own notifications read" on public.notifications;
create policy "LIRC own notifications read" on public.notifications
  for select to authenticated
  using (user_profile_id = (select lirc_private.my_profile_id()));

drop policy if exists "LIRC own notifications mark read" on public.notifications;
create policy "LIRC own notifications mark read" on public.notifications
  for update to authenticated
  using (user_profile_id = (select lirc_private.my_profile_id()))
  with check (user_profile_id = (select lirc_private.my_profile_id()));

-- Server-side only: use these to add notifications from any future feature.
create or replace function lirc_private.notify_profile(
  p_profile bigint, p_type text, p_title text, p_message text, p_link text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_profile_id, type, title, message, link)
  values (p_profile, p_type, p_title, p_message, p_link);
$$;
revoke all on function lirc_private.notify_profile(bigint,text,text,text,text) from public, anon, authenticated;

create or replace function lirc_private.notify_admins(
  p_type text, p_title text, p_message text, p_link text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_profile_id, type, title, message, link)
  select u.id, p_type, p_title, p_message, p_link
  from public."usersData" u
  where lower(btrim(u.role::text)) = 'admin';
$$;
revoke all on function lirc_private.notify_admins(text,text,text,text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Change requests for past school years
-- ---------------------------------------------------------------------------
create table if not exists public.enrollment_change_requests (
  id bigint generated always as identity primary key,
  user_profile_id bigint not null references public."usersData"(id) on delete cascade,
  academic_year_id bigint not null references public.academic_years(id) on delete restrict,
  requested_status text not null
    check (requested_status in ('enrolled','unverified','leave_of_absence','withdrawn','graduated')),
  previous_status text,
  requested_by bigint not null references public."usersData"(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  reviewed_by bigint references public."usersData"(id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists one_pending_request_per_year
  on public.enrollment_change_requests (user_profile_id, academic_year_id)
  where status = 'pending';

alter table public.enrollment_change_requests enable row level security;
revoke all privileges on table public.enrollment_change_requests from public, anon, authenticated;
grant all privileges on table public.enrollment_change_requests to service_role;
-- No client policies: only the RPCs below read or write this table.

-- ---------------------------------------------------------------------------
-- Apply one status to one year (admins directly; after approval for others).
-- Later years shift when a leave year appears or disappears; their own
-- validation stamps are preserved.
-- ---------------------------------------------------------------------------
create or replace function lirc_private.apply_enrollment_change(
  p_profile bigint, p_year bigint, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_start integer;
begin
  select a.start_year into v_start
  from public.academic_years a where a.id = p_year;
  if v_start is null then raise exception 'Academic year not found.'; end if;

  perform set_config('lirc.approved_change', 'on', true);
  if not exists (
    select 1 from public.student_enrollments
    where user_profile_id = p_profile and academic_year_id = p_year
  ) then
    insert into public.student_enrollments (user_profile_id, academic_year_id, status)
    values (p_profile, p_year, p_status);
  else
    update public.student_enrollments
       set status = p_status
     where user_profile_id = p_profile and academic_year_id = p_year;
  end if;
  perform set_config('lirc.approved_change', 'off', true);

  perform set_config('lirc.level_recompute', 'on', true);
  update public.student_enrollments e
     set year_level = lirc_private.derived_year_level(e.user_profile_id, e.academic_year_id)
    from public.academic_years ay
   where ay.id = e.academic_year_id
     and e.user_profile_id = p_profile
     and ay.start_year > v_start
     and e.status <> 'unverified';
  perform set_config('lirc.level_recompute', 'off', true);
end $$;
revoke all on function lirc_private.apply_enrollment_change(bigint,bigint,text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Trigger update: recompute mode + past-year protection.
-- ---------------------------------------------------------------------------
create or replace function lirc_private.guard_student_enrollment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  staff bigint;
  student_role text;
begin
  -- Internal recompute of derived levels: only the year level changes;
  -- validated_at / validated_by of those rows are left untouched.
  if TG_OP = 'UPDATE' and coalesce(current_setting('lirc.level_recompute', true), '') = 'on' then
    NEW.year_level := lirc_private.derived_year_level(NEW.user_profile_id, NEW.academic_year_id);
    return NEW;
  end if;

  staff := lirc_private.attendance_staff_id();
  if staff is null then
    raise exception 'A signed-in admin or librarian must validate enrollment.';
  end if;
  -- Serialize with time-in for this student so status cannot change mid-validation.
  select lower(btrim(role)) into student_role
  from public."usersData"
  where id = NEW.user_profile_id
  for update;
  if student_role is distinct from 'student' then
    raise exception 'Enrollment records are for students only.';
  end if;
  if TG_OP = 'UPDATE' then
    if (NEW.user_profile_id, NEW.academic_year_id, NEW.legacy_semester_id)
       is distinct from (OLD.user_profile_id, OLD.academic_year_id, OLD.legacy_semester_id) then
      raise exception 'Enrollment student, academic year, and migration provenance cannot be changed.';
    end if;
    NEW.created_at := OLD.created_at;
  end if;
  if TG_OP = 'INSERT' and NEW.legacy_semester_id is not null then
    raise exception 'New annual enrollment records must not set legacy_semester_id.';
  end if;

  -- Past school years change only through the approval workflow.
  if coalesce(current_setting('lirc.approved_change', true), '') <> 'on'
     and (select (now() at time zone 'Asia/Manila')::date > ay.ends_on
            from public.academic_years ay where ay.id = NEW.academic_year_id) then
    raise exception 'Past school years need admin approval. Submit a change request instead.';
  end if;

  -- The status is the only thing staff choose; the system derives the level.
  if NEW.status = 'unverified' then
    NEW.validated_at := null;
    NEW.validated_by := null;
    NEW.year_level := null;
    NEW.year_level_note := null;
    NEW.validation_reference := null;
  else
    NEW.validated_at := now();
    NEW.validated_by := staff;
    NEW.year_level := lirc_private.derived_year_level(NEW.user_profile_id, NEW.academic_year_id);
    if NEW.status = 'enrolled' and NEW.year_level is null then
      raise exception 'The card year is past four years of study. Record the student as graduated, withdrawn or on leave instead.';
    end if;
  end if;
  NEW.updated_at := now();
  return NEW;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: per-year validation history for one student
-- ---------------------------------------------------------------------------
create or replace function public.lirc_student_validation_history(p_profile_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if lirc_private.attendance_staff_id() is null then
    raise exception 'Staff access required.' using errcode = '42501';
  end if;
  if not exists (select 1 from public."usersData" where id = p_profile_id) then
    raise exception 'Library member not found.';
  end if;
  select jsonb_build_object('years', coalesce(jsonb_agg(jsonb_build_object(
      'academic_year_id', x.id,
      'name', x.name,
      'starts_on', x.starts_on,
      'ends_on', x.ends_on,
      'is_past', x.is_past,
      'before_admission', x.before_admission,
      'enrollment_id', x.enrollment_id,
      'status', x.status,
      'year_level', x.year_level,
      'validated_at', x.validated_at,
      'validator', x.validator,
      'pending', x.pending
    ) order by x.start_year desc), '[]'::jsonb))
  into result
  from (
    select ay.id, ay.name, ay.start_year, ay.starts_on, ay.ends_on,
      ((now() at time zone 'Asia/Manila')::date > ay.ends_on) as is_past,
      case when u.library_id ~ '^[0-9]{2}-'
           then ay.start_year < 2000 + substring(u.library_id from 1 for 2)::integer
           else false end as before_admission,
      e.id as enrollment_id, e.status, e.year_level, e.validated_at,
      nullif(concat_ws(' ', ve.first_name, ve.surname), '') as validator,
      case when r.id is null then null else jsonb_build_object(
        'id', r.id,
        'requested_status', r.requested_status,
        'previous_status', r.previous_status,
        'requested_by', nullif(concat_ws(' ', rb.first_name, rb.surname), ''),
        'created_at', r.created_at) end as pending
    from public.academic_years ay
    cross join public."usersData" u
    left join public.student_enrollments e
      on e.user_profile_id = u.id and e.academic_year_id = ay.id
    left join public."usersData" ve on ve.id = e.validated_by
    left join public.enrollment_change_requests r
      on r.user_profile_id = u.id and r.academic_year_id = ay.id and r.status = 'pending'
    left join public."usersData" rb on rb.id = r.requested_by
    where u.id = p_profile_id
  ) x;
  return result;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: request a past-year change (admin applies immediately)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_request_enrollment_change(
  p_profile_id bigint, p_academic_year_id bigint, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff bigint;
  v_is_past boolean;
  v_previous text;
  v_student text;
  v_year text;
begin
  v_staff := lirc_private.attendance_staff_id();
  if v_staff is null then
    raise exception 'Staff access required.' using errcode = '42501';
  end if;
  if p_status not in ('enrolled','unverified','leave_of_absence','withdrawn','graduated') then
    raise exception 'Invalid status.';
  end if;
  if not exists (select 1 from public."usersData" where id = p_profile_id) then
    raise exception 'Library member not found.';
  end if;
  select (now() at time zone 'Asia/Manila')::date > ay.ends_on, ay.name
    into v_is_past, v_year
    from public.academic_years ay
   where ay.id = p_academic_year_id;
  if v_year is null then raise exception 'Academic year not found.'; end if;
  if not v_is_past then
    raise exception 'This school year is current. Save it directly instead of requesting approval.';
  end if;

  -- Admins are the approvers: their past-year edits apply immediately.
  if lirc_private.is_admin() then
    perform lirc_private.apply_enrollment_change(p_profile_id, p_academic_year_id, p_status);
    return jsonb_build_object('applied', true);
  end if;

  if exists (
    select 1 from public.enrollment_change_requests
    where user_profile_id = p_profile_id
      and academic_year_id = p_academic_year_id
      and status = 'pending'
  ) then
    raise exception 'A change for this school year is already waiting for admin approval.';
  end if;

  select e.status into v_previous
  from public.student_enrollments e
  where e.user_profile_id = p_profile_id and e.academic_year_id = p_academic_year_id;

  select concat_ws(' ', u.first_name, u.middle_initial, u.surname, u.suffix)
    into v_student
    from public."usersData" u where u.id = p_profile_id;

  insert into public.enrollment_change_requests
    (user_profile_id, academic_year_id, requested_status, previous_status, requested_by)
  values
    (p_profile_id, p_academic_year_id, p_status, v_previous, v_staff);

  perform lirc_private.notify_admins(
    'approval_request',
    'Validation change request',
    format('%s — %s: change to %s', v_student, v_year, replace(p_status, '_', ' ')),
    '/enrollments');
  return jsonb_build_object('applied', false);
end $$;

-- ---------------------------------------------------------------------------
-- RPC: admin approves or rejects a pending request
-- ---------------------------------------------------------------------------
create or replace function public.lirc_review_enrollment_change(
  p_request_id bigint, p_approve boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_admin bigint;
  v_student text;
  v_year text;
begin
  if not lirc_private.is_admin() then
    raise exception 'Only an admin can review change requests.' using errcode = '42501';
  end if;
  v_admin := lirc_private.my_profile_id();
  select * into r from public.enrollment_change_requests
   where id = p_request_id
   for update;
  if not found then raise exception 'Request not found.'; end if;
  if r.status <> 'pending' then raise exception 'This request was already reviewed.'; end if;

  select concat_ws(' ', u.first_name, u.middle_initial, u.surname, u.suffix)
    into v_student from public."usersData" u where u.id = r.user_profile_id;
  select ay.name into v_year
    from public.academic_years ay where ay.id = r.academic_year_id;

  if p_approve then
    perform lirc_private.apply_enrollment_change(r.user_profile_id, r.academic_year_id, r.requested_status);
  end if;

  update public.enrollment_change_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         reviewed_by = v_admin,
         reviewed_at = now()
   where id = p_request_id;

  perform lirc_private.notify_profile(
    r.requested_by,
    'approval_result',
    case when p_approve then 'Validation change approved' else 'Validation change rejected' end,
    format('%s — %s: %s', v_student, v_year,
      case when p_approve
           then 'now saved as ' || replace(r.requested_status, '_', ' ')
           else 'change to ' || replace(r.requested_status, '_', ' ') || ' was rejected' end),
    '/enrollments');

  return jsonb_build_object('ok', true, 'approved', p_approve);
end $$;

-- ---------------------------------------------------------------------------
-- RPCs for the notification bell
-- ---------------------------------------------------------------------------
create or replace function public.lirc_notification_feed()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile bigint;
  result jsonb;
begin
  v_profile := lirc_private.my_profile_id();
  if v_profile is null then
    raise exception 'No library profile for this account.' using errcode = '42501';
  end if;
  select jsonb_build_object(
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
        limit 20
      ) i), '[]'::jsonb))
  into result;
  return result;
end $$;

create or replace function public.lirc_notifications_mark_read(p_ids bigint[] default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_profile bigint;
begin
  v_profile := lirc_private.my_profile_id();
  if v_profile is null then
    raise exception 'No library profile for this account.' using errcode = '42501';
  end if;
  update public.notifications
     set read_at = now()
   where user_profile_id = v_profile
     and read_at is null
     and (p_ids is null or id = any(p_ids));
  return jsonb_build_object(
    'unread',
    (select count(*) from public.notifications n
      where n.user_profile_id = v_profile and n.read_at is null));
end $$;

create or replace function public.lirc_pending_change_count()
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not lirc_private.is_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  return (select count(*) from public.enrollment_change_requests where status = 'pending');
end $$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function
  public.lirc_student_validation_history(bigint),
  public.lirc_request_enrollment_change(bigint,bigint,text),
  public.lirc_review_enrollment_change(bigint,boolean),
  public.lirc_notification_feed(),
  public.lirc_notifications_mark_read(bigint[]),
  public.lirc_pending_change_count()
  from public, anon;
grant execute on function
  public.lirc_student_validation_history(bigint),
  public.lirc_request_enrollment_change(bigint,bigint,text),
  public.lirc_review_enrollment_change(bigint,boolean),
  public.lirc_notification_feed(),
  public.lirc_notifications_mark_read(bigint[]),
  public.lirc_pending_change_count()
  to authenticated;

notify pgrst, 'reload schema';
commit;
