-- ============================================================================
-- Online library validation
--
-- A student submits proof of enrollment from their own profile. A librarian
-- or admin reviews it in the existing Library validation page. Only after
-- approval is the annual student_enrollments record changed, so the normal
-- attendance/validation rules remain the source of truth.
--
-- The student never chooses a status, year level, or approver. The request is
-- limited to the active semester's academic year; one pending request per
-- academic year; proof is required; overdue books block submission.
-- ============================================================================
begin;

create table if not exists public.library_validation_requests (
  id bigint generated always as identity primary key,
  user_profile_id bigint not null
    references public."usersData"(id) on delete cascade,
  academic_year_id bigint not null
    references public.academic_years(id) on delete restrict,
  semester_id bigint references public.semesters(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','cancelled')),
  proof_path text not null
    check (char_length(btrim(proof_path)) between 1 and 500),
  student_note text
    check (student_note is null or char_length(student_note) <= 1000),
  review_note text
    check (review_note is null or char_length(review_note) <= 1000),
  requested_at timestamptz not null default now(),
  reviewed_by bigint references public."usersData"(id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists one_pending_online_validation
  on public.library_validation_requests (user_profile_id, academic_year_id)
  where status = 'pending';
create index if not exists online_validation_status_idx
  on public.library_validation_requests (status, requested_at desc, id desc);

alter table public.library_validation_requests enable row level security;
revoke all privileges on table public.library_validation_requests
  from public, anon, authenticated;
grant all privileges on table public.library_validation_requests
  to service_role;

-- Only the RPCs below may read or write the request table. The bucket is
-- private; students upload only inside their auth-uid folder, and reviewers
-- can read the proofs through short-lived signed URLs.
insert into storage.buckets
  (id, name, public, file_size_limit, allowed_mime_types)
values
  ('validation-proofs', 'validation-proofs', false, 5242880,
   array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create or replace function lirc_private.is_validation_reviewer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public."usersData" u
    where u.user_id = (select auth.uid())
      and lower(btrim(u.role::text)) in ('librarian', 'admin')
  );
$$;
revoke all on function lirc_private.is_validation_reviewer()
  from public, anon;
grant execute on function lirc_private.is_validation_reviewer()
  to authenticated;

drop policy if exists "LIRC validation proofs upload" on storage.objects;
create policy "LIRC validation proofs upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'validation-proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "LIRC validation proofs read own or reviewer" on storage.objects;
create policy "LIRC validation proofs read own or reviewer"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'validation-proofs'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or lirc_private.is_validation_reviewer()
    )
  );

drop policy if exists "LIRC validation proofs delete own" on storage.objects;
create policy "LIRC validation proofs delete own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'validation-proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------------------------------------------------------------------------
-- The student's own status for the active semester / academic year.
-- ---------------------------------------------------------------------------
create or replace function public.lirc_my_validation_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me bigint := lirc_private.my_profile_id();
  v_role text;
  v_name text;
  v_sem_id bigint;
  v_sem_name text;
  v_sem_start date;
  v_sem_end date;
  v_ay_id bigint;
  v_ay_name text;
  v_enrollment_status text;
  v_year_level integer;
  v_validated_at timestamptz;
  v_validated_by bigint;
  v_validation_reference text;
  v_validator text;
  v_req_id bigint;
  v_req_status text;
  v_req_requested_at timestamptz;
  v_req_note text;
  v_req_review_note text;
  v_overdue integer := 0;
  v_state text;
  v_can_submit boolean := false;
begin
  if v_me is null then
    raise exception 'No library profile for this account.' using errcode = '42501';
  end if;

  select lower(btrim(u.role::text)),
         lirc_private.person_name(u.first_name, u.middle_initial, u.surname, u.suffix)
    into v_role, v_name
  from public."usersData" u
  where u.id = v_me;

  select s.id, s.name, s.starts_on, s.ends_on, s.academic_year_id, ay.name
    into v_sem_id, v_sem_name, v_sem_start, v_sem_end, v_ay_id, v_ay_name
  from public.semesters s
  join public.academic_years ay on ay.id = s.academic_year_id
  where s.is_active
  order by s.starts_on desc
  limit 1;

  if v_sem_id is not null then
    select e.status, e.year_level, e.validated_at, e.validated_by,
           e.validation_reference
      into v_enrollment_status, v_year_level, v_validated_at, v_validated_by,
           v_validation_reference
    from public.student_enrollments e
    where e.user_profile_id = v_me
      and e.academic_year_id = v_ay_id;

    select r.id, r.status, r.requested_at, r.student_note, r.review_note
      into v_req_id, v_req_status, v_req_requested_at, v_req_note,
           v_req_review_note
    from public.library_validation_requests r
    where r.user_profile_id = v_me
      and r.academic_year_id = v_ay_id
    order by r.requested_at desc, r.id desc
    limit 1;

    select count(*)::integer
      into v_overdue
    from public.book_loans l
    where l.user_profile_id = v_me
      and l.returned_at is null
      and l.due_at < now();

    if v_validated_at is not null and lower(v_enrollment_status) = 'enrolled' then
      v_state := 'validated';
    elsif v_req_id is not null and v_req_status = 'pending' then
      v_state := 'pending';
    elsif v_req_id is not null and v_req_status = 'rejected' then
      v_state := 'rejected';
    elsif v_enrollment_status is not null
          and lower(v_enrollment_status) <> 'unverified' then
      v_state := 'ineligible';
    else
      v_state := 'unverified';
    end if;

    v_can_submit :=
      lower(v_role) = 'student'
      and v_state in ('unverified', 'rejected')
      and v_overdue = 0;

    if v_validated_by is not null then
      select lirc_private.person_name(u.first_name, u.middle_initial, u.surname, u.suffix)
        into v_validator
      from public."usersData" u
      where u.id = v_validated_by;
    end if;
  else
    v_state := case when lower(v_role) = 'student' then 'no_semester' else 'not_student' end;
  end if;

  return jsonb_build_object(
    'profile_id', v_me,
    'student_name', v_name,
    'role', v_role,
    'is_student', lower(v_role) = 'student',
    'state', v_state,
    'can_submit', v_can_submit,
    'overdue_books', v_overdue,
    'semester', case when v_sem_id is null then null else jsonb_build_object(
      'id', v_sem_id, 'name', v_sem_name,
      'starts_on', v_sem_start, 'ends_on', v_sem_end) end,
    'academic_year', case when v_ay_id is null then null else jsonb_build_object(
      'id', v_ay_id, 'name', v_ay_name) end,
    'enrollment', case when v_enrollment_status is null then null else jsonb_build_object(
      'status', v_enrollment_status,
      'year_level', v_year_level,
      'validated_at', v_validated_at,
      'validation_reference', v_validation_reference) end,
    'validator', v_validator,
    'request', case when v_req_id is null then null else jsonb_build_object(
      'id', v_req_id,
      'status', v_req_status,
      'requested_at', v_req_requested_at,
      'student_note', v_req_note,
      'review_note', v_req_review_note) end
  );
end $$;

revoke all on function public.lirc_my_validation_status()
  from public, anon;
grant execute on function public.lirc_my_validation_status()
  to authenticated;

-- ---------------------------------------------------------------------------
-- Submit an online validation request (student only, own account).
-- ---------------------------------------------------------------------------
create or replace function public.lirc_submit_validation_request(
  p_proof_path text,
  p_note text default '')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me bigint := lirc_private.my_profile_id();
  v_uid text := (select auth.uid())::text;
  v_role text;
  v_name text;
  v_library_id text;
  v_sem_id bigint;
  v_ay_id bigint;
  v_status text;
  v_validated_at timestamptz;
  v_overdue integer;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_path text := nullif(btrim(coalesce(p_proof_path, '')), '');
  v_id bigint;
begin
  if v_me is null then
    raise exception 'No library profile for this account.' using errcode = '42501';
  end if;
  select lower(btrim(u.role::text)), u.library_id,
         lirc_private.person_name(u.first_name, u.middle_initial, u.surname, u.suffix)
    into v_role, v_library_id, v_name
  from public."usersData" u
  where u.id = v_me;
  if v_role is distinct from 'student' then
    raise exception 'Only students can request library validation.' using errcode = '42501';
  end if;
  if v_path is null or char_length(v_path) > 500
     or v_uid is null or v_path not like v_uid || '/%'
     or position('..' in v_path) > 0 then
    raise exception 'Upload your proof of enrollment first.';
  end if;
  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'The note is too long.';
  end if;

  select s.id, s.academic_year_id
    into v_sem_id, v_ay_id
  from public.semesters s
  where s.is_active
  order by s.starts_on desc
  limit 1;
  if v_ay_id is null then
    raise exception 'No active semester is configured. Please contact the library.';
  end if;

  select e.status, e.validated_at
    into v_status, v_validated_at
  from public.student_enrollments e
  where e.user_profile_id = v_me
    and e.academic_year_id = v_ay_id;
  if v_validated_at is not null and lower(v_status) = 'enrolled' then
    raise exception 'Your library account is already validated for this academic year.';
  end if;
  if v_status in ('leave_of_absence', 'withdrawn', 'graduated') then
    raise exception 'Your current status is not eligible for online validation. Please visit the library.';
  end if;

  if exists (
    select 1 from public.library_validation_requests r
    where r.user_profile_id = v_me
      and r.academic_year_id = v_ay_id
      and r.status = 'pending'
  ) then
    raise exception 'You already have a validation request waiting for review.';
  end if;

  select count(*)::integer into v_overdue
  from public.book_loans l
  where l.user_profile_id = v_me
    and l.returned_at is null
    and l.due_at < now();
  if v_overdue > 0 then
    raise exception 'Return your % overdue book(s) before requesting validation.', v_overdue;
  end if;

  insert into public.library_validation_requests
    (user_profile_id, academic_year_id, semester_id, proof_path, student_note)
  values
    (v_me, v_ay_id, v_sem_id, v_path, v_note)
  returning id into v_id;

  insert into public.notifications
    (user_profile_id, type, title, message, link)
  select u.id,
         'validation',
         'New online validation request',
         v_name || ' (' || v_library_id || ') submitted a library validation request.',
         '/enrollments'
  from public."usersData" u
  where lower(btrim(u.role::text)) in ('librarian', 'admin');

  return jsonb_build_object('id', v_id, 'status', 'pending');
end $$;

revoke all on function public.lirc_submit_validation_request(text, text)
  from public, anon;
grant execute on function public.lirc_submit_validation_request(text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Reviewer queue.
-- ---------------------------------------------------------------------------
create or replace function public.lirc_online_validation_requests(
  p_status text default 'pending')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not lirc_private.is_validation_reviewer() then
    raise exception 'Librarian or admin access required.' using errcode = '42501';
  end if;
  if p_status not in ('pending', 'approved', 'rejected', 'cancelled') then
    raise exception 'Invalid request status.';
  end if;

  select jsonb_build_object(
    'requests',
    coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id,
      'profile_id', u.id,
      'student', lirc_private.person_name(
        u.first_name, u.middle_initial, u.surname, u.suffix),
      'library_id', u.library_id,
      'program', (select p.name from public.programs p where p.id = u.program_id),
      'department', (select d.name from public.departments d where d.id = u.department_id),
      'academic_year', ay.name,
      'semester', s.name,
      'status', r.status,
      'proof_path', r.proof_path,
      'student_note', r.student_note,
      'review_note', r.review_note,
      'requested_at', r.requested_at,
      'reviewed_at', r.reviewed_at,
      'reviewed_by', case when rb.id is null then null else
        lirc_private.person_name(rb.first_name, rb.middle_initial, rb.surname, rb.suffix)
      end,
      'enrollment_status', e.status,
      'year_level', e.year_level
    ) order by r.requested_at desc, r.id desc), '[]'::jsonb)
  )
  into v_result
  from public.library_validation_requests r
  join public."usersData" u on u.id = r.user_profile_id
  join public.academic_years ay on ay.id = r.academic_year_id
  left join public.semesters s on s.id = r.semester_id
  left join public.student_enrollments e
    on e.user_profile_id = r.user_profile_id
   and e.academic_year_id = r.academic_year_id
  left join public."usersData" rb on rb.id = r.reviewed_by
  where r.status = p_status;

  return v_result;
end $$;

revoke all on function public.lirc_online_validation_requests(text)
  from public, anon;
grant execute on function public.lirc_online_validation_requests(text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Approve or reject one request. Approval uses the existing enrollment
-- trigger so the normal validation/attendance rules stay authoritative.
-- ---------------------------------------------------------------------------
create or replace function public.lirc_review_validation_request(
  p_request_id bigint,
  p_decision text,
  p_note text default '')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reviewer bigint := lirc_private.my_profile_id();
  v_req public.library_validation_requests%ROWTYPE;
  v_overdue integer;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not lirc_private.is_validation_reviewer() then
    raise exception 'Librarian or admin access required.' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Choose approve or reject.';
  end if;
  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'The review note is too long.';
  end if;
  if p_decision = 'rejected' and v_note is null then
    raise exception 'Give a reason when rejecting a validation request.';
  end if;

  select * into v_req
  from public.library_validation_requests
  where id = p_request_id and status = 'pending'
  for update;
  if not found then
    raise exception 'This validation request is no longer waiting for review.';
  end if;

  if p_decision = 'approved' then
    select count(*)::integer into v_overdue
    from public.book_loans l
    where l.user_profile_id = v_req.user_profile_id
      and l.returned_at is null
      and l.due_at < now();
    if v_overdue > 0 then
      raise exception 'The student has % overdue book(s). Return them before approval.', v_overdue;
    end if;

    perform lirc_private.apply_enrollment_change(
      v_req.user_profile_id, v_req.academic_year_id, 'enrolled');

    update public.student_enrollments
       set validation_reference = 'Online validation #' || v_req.id
     where user_profile_id = v_req.user_profile_id
       and academic_year_id = v_req.academic_year_id;

    update public.library_validation_requests
       set status = 'approved',
           reviewed_by = v_reviewer,
           reviewed_at = now(),
           review_note = v_note
     where id = v_req.id;

    perform lirc_private.notify_profile(
      v_req.user_profile_id,
      'validation',
      'Library validation approved',
      'Your library validation was approved. You can use the library services for this academic year.',
      '/profile');
  else
    update public.library_validation_requests
       set status = 'rejected',
           reviewed_by = v_reviewer,
           reviewed_at = now(),
           review_note = v_note
     where id = v_req.id;

    perform lirc_private.notify_profile(
      v_req.user_profile_id,
      'validation',
      'Library validation needs attention',
      coalesce('Reason: ' || v_note, 'Your validation request was rejected.'),
      '/profile');
  end if;

  return jsonb_build_object('ok', true, 'status', p_decision);
end $$;

revoke all on function public.lirc_review_validation_request(bigint, text, text)
  from public, anon;
grant execute on function public.lirc_review_validation_request(bigint, text, text)
  to authenticated;

notify pgrst, 'reload schema';
commit;
