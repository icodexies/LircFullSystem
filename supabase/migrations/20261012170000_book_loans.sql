-- Book borrowing: loans by accession number, with staff-chosen dates.
--
-- Rules (mirrored by the borrow screen and validated here):
--   * Only staff / librarian / admin may borrow or return.
--   * Staff choose the start and due date+time (old records can be entered).
--     Validations: due after start, no span over a year, start not in the
--     future, return not before the start or in the future.
--   * A copy is unavailable while it has an open (unreturned) loan. The
--     accession status column is shown as a hint only.
--   * Students need a validated enrollment for the current school year when
--     the loan starts inside that school year. Historical records (start
--     outside the current year) skip this check so old data can be entered.
--   * No loan limits and no fees in this version. Fees stay easy to add:
--     every needed date is stored here, and the return RPC is the single
--     place to compute one later. See docs/BORROW.md.
begin;

create table if not exists public.book_loans (
  id bigint generated always as identity primary key,
  accession_id bigint not null references public.book_accession_numbers(id) on delete restrict,
  user_profile_id bigint not null references public."usersData"(id) on delete restrict,
  borrowed_at timestamptz not null,
  due_at timestamptz not null,
  returned_at timestamptz,
  recorded_by bigint not null references public."usersData"(id) on delete restrict,
  returned_by bigint references public."usersData"(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (due_at > borrowed_at),
  check (returned_at is null or returned_at >= borrowed_at)
);
create unique index if not exists one_open_loan_per_copy
  on public.book_loans (accession_id)
  where returned_at is null;
create index if not exists loans_profile_idx
  on public.book_loans (user_profile_id, borrowed_at desc, id desc);
create index if not exists loans_accession_idx
  on public.book_loans (accession_id, borrowed_at desc, id desc);

alter table public.book_loans enable row level security;
revoke all privileges on table public.book_loans from public, anon, authenticated;
grant all privileges on table public.book_loans to service_role;
-- No client policies: only the RPCs below read or write this table.

-- Who counts as a library operator for borrowing: staff, librarian or admin.
create or replace function lirc_private.library_operator_id()
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
revoke all on function lirc_private.library_operator_id() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: preview a member before lending (validation + overdue warning)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_borrow_preview(p_library_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_card text;
  u public."usersData"%ROWTYPE;
  v_active_year_id bigint;
  v_year_starts date;
  v_year_ends date;
  e public.student_enrollments%ROWTYPE;
  v_active int;
  v_overdue int;
  v_overdue_text text;
  v_required boolean := false;
  v_ok boolean := true;
  v_reason text := '';
begin
  if lirc_private.library_operator_id() is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  v_card := btrim(p_library_id);
  if v_card ~ '^\*.*\*$' and length(v_card) > 2 then
    v_card := substr(v_card, 2, length(v_card) - 2);
  end if;
  if v_card = '' or length(v_card) > 120 then
    raise exception 'Enter a valid library card.';
  end if;

  select * into u from public."usersData" where library_id = v_card;
  if not found then raise exception 'Library card not found.'; end if;

  select ay.id, ay.starts_on, ay.ends_on
    into v_active_year_id, v_year_starts, v_year_ends
  from public.semesters s
  join public.academic_years ay on ay.id = s.academic_year_id
  where s.is_active
  limit 1;

  if lower(btrim(u.role::text)) = 'student' and v_active_year_id is not null then
    v_required := true;
    select * into e from public.student_enrollments
    where user_profile_id = u.id and academic_year_id = v_active_year_id;
    if not found then
      v_ok := false;
      v_reason := 'Student has no annual validation for the current school year.';
    elsif e.status <> 'enrolled' or e.validated_at is null
          or e.year_level is null or e.year_level not between 1 and 4 then
      v_ok := false;
      v_reason := format('Student is not validated as enrolled (status: %).', e.status);
    end if;
  end if;

  select count(*) filter (where l.returned_at is null),
         count(*) filter (where l.returned_at is null and l.due_at < now())
    into v_active, v_overdue
  from public.book_loans l
  where l.user_profile_id = u.id;

  select string_agg(x.item, ', ') into v_overdue_text
  from (
    select b.book_name
             || ' (due '
             || to_char(l.due_at at time zone 'Asia/Manila', 'Mon DD')
             || ')' as item
    from public.book_loans l
    join public.book_accession_numbers a on a.id = l.accession_id
    join public.books b on b.id = a.book_id
    where l.user_profile_id = u.id
      and l.returned_at is null
      and l.due_at < now()
    order by l.due_at
    limit 3
  ) x;

  return jsonb_build_object(
    'profile', jsonb_build_object(
      'id', u.id,
      'full_name', concat_ws(' ', u.first_name, u.middle_initial, u.surname, u.suffix),
      'library_id', u.library_id,
      'role', u.role),
    'student_check', jsonb_build_object(
      'required', v_required,
      'ok', v_ok,
      'reason', v_reason,
      'year_starts', v_year_starts,
      'year_ends', v_year_ends),
    'active_loans', coalesce(v_active, 0),
    'overdue_loans', coalesce(v_overdue, 0),
    'overdue_text', coalesce(v_overdue_text, ''));
end $$;

-- ---------------------------------------------------------------------------
-- RPC: record a loan for one accession number
-- ---------------------------------------------------------------------------
create or replace function public.lirc_borrow_book(
  p_accession text,
  p_profile_id bigint,
  p_start timestamptz,
  p_due timestamptz,
  p_returned_at timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operator bigint;
  v_accession text;
  v_accession_id bigint;
  v_status text;
  v_role text;
  v_active_year_id bigint;
  v_in_active_year boolean := false;
  e public.student_enrollments%ROWTYPE;
  v_loan_id bigint;
begin
  v_operator := lirc_private.library_operator_id();
  if v_operator is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;

  v_accession := btrim(p_accession);
  if v_accession ~ '^\*.*\*$' and length(v_accession) > 2 then
    v_accession := substr(v_accession, 2, length(v_accession) - 2);
  end if;
  if v_accession = '' or length(v_accession) > 120 then
    raise exception 'Enter a valid accession number.';
  end if;

  -- Staff choose the real dates; old records can be entered too.
  if p_start is null or p_due is null then
    raise exception 'Provide the start and due date/time.';
  end if;
  if p_start < timestamptz '2015-01-01 00:00+08' or p_start > now() + interval '1 day' then
    raise exception 'The start date/time looks invalid. Use a real past or present date.';
  end if;
  if p_due <= p_start then
    raise exception 'The due date/time must be after the start date/time.';
  end if;
  if p_due - p_start > interval '366 days' then
    raise exception 'A loan longer than one year looks like a mistake. Check the dates.';
  end if;
  if p_returned_at is not null then
    if p_returned_at < p_start then
      raise exception 'The return date/time cannot be before the start.';
    end if;
    if p_returned_at > now() + interval '1 day' then
      raise exception 'The return date/time cannot be in the future.';
    end if;
  end if;

  select a.id, a.status into v_accession_id, v_status
  from public.book_accession_numbers a
  where a.accession_number = v_accession;
  if v_accession_id is null then
    raise exception 'Accession number % was not found.', v_accession;
  end if;
  if v_status is not null and lower(btrim(v_status)) not in ('available', '') then
    raise exception 'This copy is marked "%". Choose an available copy.', v_status;
  end if;
  if exists (
    select 1 from public.book_loans l
    where l.accession_id = v_accession_id and l.returned_at is null
  ) then
    raise exception 'This copy is already on loan. Return it first.';
  end if;

  select lower(btrim(role::text)) into v_role
  from public."usersData" where id = p_profile_id for update;
  if not found then raise exception 'Library member not found.'; end if;

  -- Students need a validated enrollment, but only when the loan starts
  -- inside the current school year (historical records skip this check).
  if v_role = 'student' then
    select ay.id into v_active_year_id
    from public.semesters s
    join public.academic_years ay on ay.id = s.academic_year_id
    where s.is_active
    limit 1;
    if v_active_year_id is not null then
      select exists (
        select 1 from public.academic_years ay
        where ay.id = v_active_year_id
          and (p_start at time zone 'Asia/Manila')::date between ay.starts_on and ay.ends_on
      ) into v_in_active_year;
      if v_in_active_year then
        select * into e from public.student_enrollments
        where user_profile_id = p_profile_id and academic_year_id = v_active_year_id;
        if not found then
          raise exception 'Student has no annual validation for the current school year.';
        end if;
        if e.status <> 'enrolled' or e.validated_at is null
           or e.year_level is null or e.year_level not between 1 and 4 then
          raise exception 'Student is not validated as enrolled (status: %).', e.status;
        end if;
      end if;
    end if;
  end if;

  insert into public.book_loans
    (accession_id, user_profile_id, borrowed_at, due_at, returned_at, recorded_by, returned_by)
  values
    (v_accession_id, p_profile_id, p_start, p_due, p_returned_at, v_operator,
     case when p_returned_at is null then null else v_operator end)
  returning id into v_loan_id;

  return jsonb_build_object('id', v_loan_id, 'returned', p_returned_at is not null);
end $$;

-- ---------------------------------------------------------------------------
-- RPC: return a loan
-- ---------------------------------------------------------------------------
create or replace function public.lirc_return_loan(
  p_loan_id bigint,
  p_returned_at timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operator bigint;
  l public.book_loans%ROWTYPE;
  v_returned timestamptz;
begin
  v_operator := lirc_private.library_operator_id();
  if v_operator is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  select * into l from public.book_loans where id = p_loan_id for update;
  if not found then raise exception 'Loan not found.'; end if;
  if l.returned_at is not null then raise exception 'This loan is already returned.'; end if;
  v_returned := coalesce(p_returned_at, now());
  if v_returned < l.borrowed_at then
    raise exception 'The return date/time cannot be before the start.';
  end if;
  if v_returned > now() + interval '1 day' then
    raise exception 'The return date/time cannot be in the future.';
  end if;
  update public.book_loans
     set returned_at = v_returned, returned_by = v_operator
   where id = p_loan_id;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------
-- RPC: all loans of one book (people who borrowed it)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_book_loans(p_book_id bigint)
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
  select jsonb_build_object('loans', coalesce(jsonb_agg(jsonb_build_object(
      'id', x.loan_id,
      'accession_id', x.accession_id,
      'accession_number', x.accession_number,
      'holder', x.holder,
      'library_id', x.member_card,
      'role', x.member_role,
      'borrowed_at', x.borrowed_at,
      'due_at', x.due_at,
      'returned_at', x.returned_at,
      'is_open', x.is_open,
      'is_overdue', x.is_overdue
    ) order by x.borrowed_at desc, x.loan_id desc), '[]'::jsonb))
  into result
  from (
    select l.id as loan_id, a.id as accession_id, a.accession_number,
      concat_ws(' ', u.first_name, u.middle_initial, u.surname, u.suffix) as holder,
      u.library_id as member_card, u.role as member_role,
      l.borrowed_at, l.due_at, l.returned_at,
      l.returned_at is null as is_open,
      (l.returned_at is null and l.due_at < now()) as is_overdue
    from public.book_loans l
    join public.book_accession_numbers a on a.id = l.accession_id
    join public."usersData" u on u.id = l.user_profile_id
    where a.book_id = p_book_id
    order by l.borrowed_at desc, l.id desc
    limit 100
  ) x;
  return result;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: all loans of one member (books borrowed by a person)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_member_loans(p_profile_id bigint)
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
  select jsonb_build_object('loans', coalesce(jsonb_agg(jsonb_build_object(
      'id', x.loan_id,
      'book_id', x.book_id,
      'book_name', x.book_name,
      'accession_number', x.accession_number,
      'borrowed_at', x.borrowed_at,
      'due_at', x.due_at,
      'returned_at', x.returned_at,
      'is_open', x.is_open,
      'is_overdue', x.is_overdue
    ) order by x.borrowed_at desc, x.loan_id desc), '[]'::jsonb))
  into result
  from (
    select l.id as loan_id, b.id as book_id, b.book_name,
      a.accession_number, l.borrowed_at, l.due_at, l.returned_at,
      l.returned_at is null as is_open,
      (l.returned_at is null and l.due_at < now()) as is_overdue
    from public.book_loans l
    join public.book_accession_numbers a on a.id = l.accession_id
    join public.books b on b.id = a.book_id
    where l.user_profile_id = p_profile_id
    order by l.borrowed_at desc, l.id desc
    limit 200
  ) x;
  return result;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: find members by name or card (for the member loans view)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_member_lookup(p_search text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text;
  result jsonb;
begin
  if lirc_private.library_operator_id() is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  v_search := btrim(p_search);
  if v_search = '' or length(v_search) > 120 then
    raise exception 'Type a name or library card.';
  end if;
  select jsonb_build_object('members', coalesce(jsonb_agg(jsonb_build_object(
      'id', x.id,
      'full_name', x.full_name,
      'library_id', x.library_id,
      'role', x.role,
      'active_loans', x.active_loans,
      'overdue_loans', x.overdue_loans
    ) order by x.surname, x.id), '[]'::jsonb))
  into result
  from (
    select u.id,
      concat_ws(' ', u.first_name, u.middle_initial, u.surname, u.suffix) as full_name,
      u.library_id, u.role, u.surname,
      (select count(*) from public.book_loans l
        where l.user_profile_id = u.id and l.returned_at is null) as active_loans,
      (select count(*) from public.book_loans l
        where l.user_profile_id = u.id and l.returned_at is null and l.due_at < now()) as overdue_loans
    from public."usersData" u
    where u.library_id = v_search
       or concat_ws(' ', u.first_name, u.middle_initial, u.surname, u.suffix) ilike '%' || v_search || '%'
       or u.surname ilike v_search || '%'
    order by u.surname, u.id
    limit 10
  ) x;
  return result;
end $$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function
  public.lirc_borrow_preview(text),
  public.lirc_borrow_book(text,bigint,timestamptz,timestamptz,timestamptz),
  public.lirc_return_loan(bigint,timestamptz),
  public.lirc_book_loans(bigint),
  public.lirc_member_loans(bigint),
  public.lirc_member_lookup(text)
  from public, anon;
grant execute on function
  public.lirc_borrow_preview(text),
  public.lirc_borrow_book(text,bigint,timestamptz,timestamptz,timestamptz),
  public.lirc_return_loan(bigint,timestamptz),
  public.lirc_book_loans(bigint),
  public.lirc_member_loans(bigint),
  public.lirc_member_lookup(text)
  to authenticated;

notify pgrst, 'reload schema';
commit;
