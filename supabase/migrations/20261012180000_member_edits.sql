-- Member records: profile view with histories, and admin-approved edits.
--
-- Staff / librarian edits to a member profile become REQUESTS; admins review
-- them (approve applies the change, reject keeps the record). Admin edits
-- apply immediately. Every action creates a notification whose link opens
-- the exact request on the Users page (/users?request=<id>).
-- Editable fields: first name, surname, M.I., suffix, department, program,
-- position. Role, library card and account links stay locked.
begin;

create table if not exists public.member_change_requests (
  id bigint generated always as identity primary key,
  user_profile_id bigint not null references public."usersData"(id) on delete cascade,
  requested_changes jsonb not null,
  previous_values jsonb not null default '{}'::jsonb,
  requested_by bigint not null references public."usersData"(id) on delete restrict,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  reviewed_by bigint references public."usersData"(id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists one_pending_member_change
  on public.member_change_requests (user_profile_id)
  where status = 'pending';

alter table public.member_change_requests enable row level security;
revoke all privileges on table public.member_change_requests from public, anon, authenticated;
grant all privileges on table public.member_change_requests to service_role;
-- No client policies: only the RPCs below read or write this table.

-- ---------------------------------------------------------------------------
-- Internal: validate + trim requested changes; keep only real changes.
-- ---------------------------------------------------------------------------
create or replace function lirc_private.sanitize_member_changes(
  p_changes jsonb, p_profile bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb := '{}'::jsonb;
  v text;
  u public."usersData"%ROWTYPE;
begin
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' then
    raise exception 'Invalid changes.';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_changes) k
    where k not in ('first_name','surname','middle_initial','suffix',
                    'department_id','program_id','position_classification_id')
  ) then
    raise exception 'Invalid changes.';
  end if;
  select * into u from public."usersData" where id = p_profile;
  if not found then raise exception 'Library member not found.'; end if;

  if p_changes ? 'first_name' then
    v := btrim(p_changes->>'first_name');
    if v = '' or length(v) > 100 then
      raise exception 'First name must be 1-100 characters.';
    end if;
    if v is distinct from u.first_name then
      result := result || jsonb_build_object('first_name', v);
    end if;
  end if;
  if p_changes ? 'surname' then
    v := btrim(p_changes->>'surname');
    if v = '' or length(v) > 100 then
      raise exception 'Surname must be 1-100 characters.';
    end if;
    if v is distinct from u.surname then
      result := result || jsonb_build_object('surname', v);
    end if;
  end if;
  if p_changes ? 'middle_initial' then
    v := btrim(p_changes->>'middle_initial');
    if length(v) > 2 then
      raise exception 'M.I. must be 2 characters or fewer.';
    end if;
    if nullif(v, '') is distinct from nullif(btrim(u.middle_initial), '') then
      result := result || jsonb_build_object('middle_initial', nullif(v, ''));
    end if;
  end if;
  if p_changes ? 'suffix' then
    v := btrim(p_changes->>'suffix');
    if length(v) > 20 then
      raise exception 'Suffix must be 20 characters or fewer.';
    end if;
    if nullif(v, '') is distinct from nullif(btrim(u.suffix), '') then
      result := result || jsonb_build_object('suffix', nullif(v, ''));
    end if;
  end if;

  if p_changes ? 'department_id' then
    v := btrim(coalesce(p_changes->>'department_id', ''));
    if v <> '' and v !~ '^[1-9][0-9]*$' then
      raise exception 'Choose a valid department.';
    end if;
    if v <> '' and not exists (select 1 from public.departments d where d.id = v::bigint) then
      raise exception 'Department not found.';
    end if;
    if nullif(v, '') is distinct from nullif(u.department_id::text, '') then
      result := result || jsonb_build_object('department_id',
        case when v = '' then null else v::bigint end);
    end if;
  end if;
  if p_changes ? 'program_id' then
    v := btrim(coalesce(p_changes->>'program_id', ''));
    if v <> '' and v !~ '^[1-9][0-9]*$' then
      raise exception 'Choose a valid program.';
    end if;
    if v <> '' and not exists (select 1 from public.programs p where p.id = v::bigint) then
      raise exception 'Program not found.';
    end if;
    if nullif(v, '') is distinct from nullif(u.program_id::text, '') then
      result := result || jsonb_build_object('program_id',
        case when v = '' then null else v::bigint end);
    end if;
  end if;
  if p_changes ? 'position_classification_id' then
    v := btrim(coalesce(p_changes->>'position_classification_id', ''));
    if v <> '' and v !~ '^[1-9][0-9]*$' then
      raise exception 'Choose a valid position.';
    end if;
    if v <> '' and not exists (
      select 1 from public.position_classifications pc where pc.id = v::bigint
    ) then
      raise exception 'Position not found.';
    end if;
    if nullif(v, '') is distinct from nullif(u.position_classification_id::text, '') then
      result := result || jsonb_build_object('position_classification_id',
        case when v = '' then null else v::bigint end);
    end if;
  end if;
  return result;
end $$;
revoke all on function lirc_private.sanitize_member_changes(jsonb,bigint) from public, anon, authenticated;

-- Apply already-sanitized changes (static column names; safe formatting).
create or replace function lirc_private.apply_member_change(
  p_profile bigint, p_changes jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare parts text[] := '{}'::text[];
begin
  if p_changes ? 'first_name' then
    parts := parts || format('first_name = %L', nullif(btrim(p_changes->>'first_name'), ''));
  end if;
  if p_changes ? 'surname' then
    parts := parts || format('surname = %L', nullif(btrim(p_changes->>'surname'), ''));
  end if;
  if p_changes ? 'middle_initial' then
    parts := parts || format('middle_initial = %L', nullif(btrim(p_changes->>'middle_initial'), ''));
  end if;
  if p_changes ? 'suffix' then
    parts := parts || format('suffix = %L', nullif(btrim(p_changes->>'suffix'), ''));
  end if;
  if p_changes ? 'department_id' then
    parts := parts || format('department_id = %L', nullif(p_changes->>'department_id', ''));
  end if;
  if p_changes ? 'program_id' then
    parts := parts || format('program_id = %L', nullif(p_changes->>'program_id', ''));
  end if;
  if p_changes ? 'position_classification_id' then
    parts := parts || format('position_classification_id = %L', nullif(p_changes->>'position_classification_id', ''));
  end if;
  if array_length(parts, 1) is null then
    raise exception 'Nothing to change.';
  end if;
  execute 'update public."usersData" set ' || array_to_string(parts, ', ')
       || ' where id = ' || p_profile::text;
end $$;
revoke all on function lirc_private.apply_member_change(bigint,jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: member profile for the Users page
-- ---------------------------------------------------------------------------
create or replace function public.lirc_member_profile(p_profile_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if lirc_private.library_operator_id() is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'id', u.id,
    'full_name', concat_ws(' ', u.first_name, u.middle_initial, u.surname, u.suffix),
    'first_name', u.first_name,
    'surname', u.surname,
    'middle_initial', u.middle_initial,
    'suffix', u.suffix,
    'library_id', u.library_id,
    'role', u.role,
    'user_linked', u.user_id is not null,
    'department_id', u.department_id,
    'program_id', u.program_id,
    'position_classification_id', u.position_classification_id,
    'department', d.name,
    'program', p.name,
    'position', pc.name,
    'active_loans', (select count(*) from public.book_loans l
      where l.user_profile_id = u.id and l.returned_at is null),
    'overdue_loans', (select count(*) from public.book_loans l
      where l.user_profile_id = u.id and l.returned_at is null and l.due_at < now()),
    'visits', (select count(*) from public.attendance a
      where a.user_profile_id = u.id))
  into result
  from public."usersData" u
  left join public.departments d on d.id = u.department_id
  left join public.programs p on p.id = u.program_id
  left join public.position_classifications pc on pc.id = u.position_classification_id
  where u.id = p_profile_id;
  if result is null then raise exception 'Library member not found.'; end if;
  return result;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: one member's attendance history
-- ---------------------------------------------------------------------------
create or replace function public.lirc_member_attendance(p_profile_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if lirc_private.library_operator_id() is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  if not exists (select 1 from public."usersData" where id = p_profile_id) then
    raise exception 'Library member not found.';
  end if;
  select jsonb_build_object('visits', coalesce(jsonb_agg(jsonb_build_object(
      'id', x.visit_id,
      'semester', x.semester_name,
      'purpose', x.purpose,
      'time_in', x.time_in,
      'time_out', x.time_out,
      'minutes', x.minutes,
      'is_open', x.is_open
    ) order by x.time_in desc, x.visit_id desc), '[]'::jsonb))
  into result
  from (
    select a.id as visit_id,
      ay.name || ' · ' || s.name as semester_name,
      a.purpose_of_visit as purpose,
      a.time_in, a.time_out,
      case when a.time_out is null then null
           else round(extract(epoch from a.time_out - a.time_in) / 60) end as minutes,
      a.time_out is null as is_open
    from public.attendance a
    join public.semesters s on s.id = a.semester_id
    join public.academic_years ay on ay.id = s.academic_year_id
    where a.user_profile_id = p_profile_id
    order by a.time_in desc, a.id desc
    limit 100
  ) x;
  return result;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: request (or directly apply, for admins) a member profile edit
-- ---------------------------------------------------------------------------
create or replace function public.lirc_request_member_change(
  p_profile_id bigint, p_changes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operator bigint;
  v_changes jsonb;
  v_previous jsonb;
  v_member text;
  v_card text;
  v_id bigint;
begin
  v_operator := lirc_private.library_operator_id();
  if v_operator is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  v_changes := lirc_private.sanitize_member_changes(p_changes, p_profile_id);
  if v_changes = '{}'::jsonb then
    raise exception 'Nothing changed.';
  end if;

  select concat_ws(' ', u.first_name, u.middle_initial, u.surname, u.suffix), u.library_id,
         jsonb_build_object(
           'first_name', u.first_name, 'surname', u.surname,
           'middle_initial', u.middle_initial, 'suffix', u.suffix,
           'department_id', u.department_id, 'program_id', u.program_id,
           'position_classification_id', u.position_classification_id)
    into v_member, v_card, v_previous
  from public."usersData" u where u.id = p_profile_id;

  -- Admins are the approvers: their edits apply immediately.
  if lirc_private.is_admin() then
    perform lirc_private.apply_member_change(p_profile_id, v_changes);
    return jsonb_build_object('applied', true);
  end if;

  if exists (
    select 1 from public.member_change_requests
    where user_profile_id = p_profile_id and status = 'pending'
  ) then
    raise exception 'An edit for this member is already waiting for admin approval.';
  end if;

  insert into public.member_change_requests
    (user_profile_id, requested_changes, previous_values, requested_by)
  values (p_profile_id, v_changes, v_previous, v_operator)
  returning id into v_id;

  perform lirc_private.notify_admins(
    'member_edit_request',
    'Member edit request',
    format('%s (%s) — profile edit waiting for approval', v_member, v_card),
    '/users?request=' || v_id);

  return jsonb_build_object('applied', false, 'request_id', v_id);
end $$;

-- ---------------------------------------------------------------------------
-- RPC: list change requests (admins see all; staff see their own)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_member_change_requests(
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
      'member', x.member,
      'member_card', x.member_card,
      'requested_changes', x.requested_changes,
      'previous_values', x.previous_values,
      'requested_by', x.requested_by,
      'status', x.status,
      'reviewed_by', x.reviewed_by,
      'reviewed_at', x.reviewed_at,
      'created_at', x.created_at
    ) order by x.created_at desc, x.id desc), '[]'::jsonb))
  into result
  from (
    select r.id,
      concat_ws(' ', u.first_name, u.middle_initial, u.surname, u.suffix) as member,
      u.library_id as member_card,
      r.requested_changes, r.previous_values,
      concat_ws(' ', rb.first_name, rb.surname) as requested_by,
      r.status,
      nullif(concat_ws(' ', rv.first_name, rv.surname), '') as reviewed_by,
      r.reviewed_at, r.created_at
    from public.member_change_requests r
    join public."usersData" u on u.id = r.user_profile_id
    join public."usersData" rb on rb.id = r.requested_by
    left join public."usersData" rv on rv.id = r.reviewed_by
    where not p_only_mine or r.requested_by = v_operator
    order by r.created_at desc, r.id desc
    limit 100
  ) x;
  return result;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: admin approves or rejects a member edit request
-- ---------------------------------------------------------------------------
create or replace function public.lirc_review_member_change(
  p_request_id bigint, p_approve boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_admin bigint;
begin
  if not lirc_private.is_admin() then
    raise exception 'Only an admin can review edit requests.' using errcode = '42501';
  end if;
  v_admin := lirc_private.my_profile_id();
  select * into r from public.member_change_requests
   where id = p_request_id
   for update;
  if not found then raise exception 'Request not found.'; end if;
  if r.status <> 'pending' then raise exception 'This request was already reviewed.'; end if;

  if p_approve then
    perform lirc_private.apply_member_change(r.user_profile_id, r.requested_changes);
  end if;

  update public.member_change_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         reviewed_by = v_admin,
         reviewed_at = now()
   where id = p_request_id;

  perform lirc_private.notify_profile(
    r.requested_by,
    'member_edit_result',
    case when p_approve then 'Member edit approved' else 'Member edit rejected' end,
    'Your profile edit request was ' || case when p_approve then 'approved and saved.' else 'rejected.' end,
    '/users?request=' || p_request_id);

  return jsonb_build_object('ok', true, 'approved', p_approve);
end $$;

revoke all on function
  public.lirc_member_profile(bigint),
  public.lirc_member_attendance(bigint),
  public.lirc_request_member_change(bigint,jsonb),
  public.lirc_member_change_requests(boolean),
  public.lirc_review_member_change(bigint,boolean)
  from public, anon;
grant execute on function
  public.lirc_member_profile(bigint),
  public.lirc_member_attendance(bigint),
  public.lirc_request_member_change(bigint,jsonb),
  public.lirc_member_change_requests(boolean),
  public.lirc_review_member_change(bigint,boolean)
  to authenticated;

notify pgrst, 'reload schema';
commit;
