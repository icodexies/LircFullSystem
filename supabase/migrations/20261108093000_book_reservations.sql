-- ============================================================================
-- Book reservations (1-hour pickup holds)
--
-- Rules:
--   * Students and faculty only.
--   * Maximum 3 active reservations per member.
--   * The member must have no overdue loans.
--   * A book can only be reserved while at least 2 copies are free, so the
--     reservation never takes the last available copy.
--   * A hold expires exactly 1 hour after creation; it is not a loan.
--   * The exact reserved copy is held. Borrowing a copy reserved by someone
--     else is rejected by a trigger; borrowing it by the reserver fulfils it.
--   * Expiry is lazy: every reservation/availability/borrow operation runs the
--     cleanup first, so a stale hold can never block a copy indefinitely.
-- ============================================================================
begin;

create table if not exists public.book_reservations (
  id bigint generated always as identity primary key,
  accession_id bigint not null
    references public.book_accession_numbers(id) on delete restrict,
  book_id bigint not null
    references public.books(id) on delete cascade,
  user_profile_id bigint not null
    references public."usersData"(id) on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'fulfilled', 'expired', 'cancelled')),
  reserved_at timestamptz not null default now(),
  expires_at timestamptz not null,
  fulfilled_loan_id bigint references public.book_loans(id) on delete set null,
  fulfilled_at timestamptz,
  cancelled_by bigint references public."usersData"(id) on delete set null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > reserved_at),
  check (expires_at <= reserved_at + interval '1 hour 1 minute')
);

create unique index if not exists one_active_reservation_per_copy
  on public.book_reservations (accession_id)
  where status = 'active';
create unique index if not exists one_active_reservation_per_member_book
  on public.book_reservations (user_profile_id, book_id)
  where status = 'active';
create index if not exists reservations_profile_idx
  on public.book_reservations (user_profile_id, reserved_at desc, id desc);
create index if not exists reservations_book_idx
  on public.book_reservations (book_id, status, expires_at);
create index if not exists reservations_expiry_idx
  on public.book_reservations (status, expires_at);

alter table public.book_reservations enable row level security;
revoke all privileges on table public.book_reservations
  from public, anon, authenticated;
grant all privileges on table public.book_reservations to service_role;

-- ---------------------------------------------------------------------------
-- Expiry (lazy). Called by every operation that reads or changes holds.
-- ---------------------------------------------------------------------------
create or replace function lirc_private.expire_book_reservations()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.book_reservations
     set status = 'expired'
   where status = 'active'
     and expires_at <= now();
$$;
revoke all on function lirc_private.expire_book_reservations()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Eligibility / availability for one member and one book.
-- ---------------------------------------------------------------------------
create or replace function lirc_private.book_reservation_status(
  p_profile bigint,
  p_book bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_available integer := 0;
  v_active integer := 0;
  v_same integer := 0;
  v_overdue integer := 0;
  v_ok boolean := true;
  v_reason text := '';
  v_ay bigint;
  v_enrollment_status text;
  v_validated_at timestamptz;
  v_year_level integer;
begin
  perform lirc_private.expire_book_reservations();

  if not exists (select 1 from public.books b where b.id = p_book) then
    return jsonb_build_object(
      'can_reserve', false,
      'reason', 'Book record not found.',
      'available_count', 0,
      'active_count', 0
    );
  end if;

  select lower(btrim(u.role::text)) into v_role
  from public."usersData" u
  where u.id = p_profile;

  select count(*) into v_active
  from public.book_reservations r
  where r.user_profile_id = p_profile and r.status = 'active';

  select count(*) into v_same
  from public.book_reservations r
  where r.user_profile_id = p_profile
    and r.book_id = p_book
    and r.status = 'active';

  select count(*) into v_overdue
  from public.book_loans l
  where l.user_profile_id = p_profile
    and l.returned_at is null
    and l.due_at < now();

  select count(*) into v_available
  from public.book_accession_numbers a
  where a.book_id = p_book
    and lower(btrim(coalesce(a.status, ''))) in ('', 'available')
    and not exists (
      select 1 from public.book_loans l
      where l.accession_id = a.id and l.returned_at is null
    )
    and not exists (
      select 1 from public.book_reservations r
      where r.accession_id = a.id
        and r.status = 'active'
        and r.expires_at > now()
    );

  if v_role is null then
    v_ok := false;
    v_reason := 'Library account not found.';
  elsif v_role not in ('student', 'faculty') then
    v_ok := false;
    v_reason := 'Only students and faculty can reserve books.';
  elsif v_active >= 3 then
    v_ok := false;
    v_reason := 'You already have 3 active reservations. Cancel one first.';
  elsif v_same > 0 then
    v_ok := false;
    v_reason := 'You already have a reservation for this book.';
  elsif v_overdue > 0 then
    v_ok := false;
    v_reason := format(
      'Return your % overdue book(s) before reserving another title.',
      v_overdue
    );
  elsif v_role = 'student' then
    select s.academic_year_id into v_ay
    from public.semesters s
    where s.is_active
    order by s.starts_on desc
    limit 1;
    if v_ay is not null then
      select e.status, e.validated_at, e.year_level
        into v_enrollment_status, v_validated_at, v_year_level
      from public.student_enrollments e
      where e.user_profile_id = p_profile
        and e.academic_year_id = v_ay;
      if not found
         or v_enrollment_status <> 'enrolled'
         or v_validated_at is null
         or v_year_level is null
         or v_year_level not between 1 and 4 then
        v_ok := false;
        v_reason := 'Complete your library validation for the current school year first.';
      end if;
    end if;
  end if;

  if v_ok and v_available < 2 then
    v_ok := false;
    v_reason := format(
      'Reservations need at least two free copies. There %s only %s free copy%s left.',
      case when v_available = 1 then 'is' else 'are' end,
      v_available,
      case when v_available = 1 then '' else 'ies' end
    );
  end if;

  return jsonb_build_object(
    'can_reserve', v_ok,
    'reason', v_reason,
    'available_count', v_available,
    'active_count', v_active,
    'max_reservations', 3,
    'role', v_role
  );
end $$;
revoke all on function lirc_private.book_reservation_status(bigint, bigint)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Create a hold. The book row lock serializes the "at least 2 copies" check.
-- ---------------------------------------------------------------------------
create or replace function public.lirc_reserve_book(p_book_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me bigint := lirc_private.my_profile_id();
  v_status jsonb;
  v_accession_id bigint;
  v_accession_number text;
  v_book_name text;
  v_reserved_at timestamptz;
  v_expires_at timestamptz;
  v_id bigint;
begin
  if v_me is null then
    raise exception 'Sign in to reserve a book.' using errcode = '42501';
  end if;

  perform 1 from public.books where id = p_book_id for update;
  if not found then
    raise exception 'Book record not found.';
  end if;
  perform 1 from public."usersData" where id = v_me for update;

  v_status := lirc_private.book_reservation_status(v_me, p_book_id);
  if not coalesce((v_status->>'can_reserve')::boolean, false) then
    raise exception '%', coalesce(v_status->>'reason', 'This book cannot be reserved.');
  end if;

  select a.id, a.accession_number
    into v_accession_id, v_accession_number
  from public.book_accession_numbers a
  where a.book_id = p_book_id
    and lower(btrim(coalesce(a.status, ''))) in ('', 'available')
    and not exists (
      select 1 from public.book_loans l
      where l.accession_id = a.id and l.returned_at is null
    )
    and not exists (
      select 1 from public.book_reservations r
      where r.accession_id = a.id
        and r.status = 'active'
        and r.expires_at > now()
    )
  order by a.accession_number, a.id
  limit 1
  for update;

  if v_accession_id is null then
    raise exception 'No copy is free for reservation.';
  end if;

  select b.book_name into v_book_name
  from public.books b where b.id = p_book_id;

  v_reserved_at := clock_timestamp();
  v_expires_at := v_reserved_at + interval '1 hour';

  insert into public.book_reservations
    (accession_id, book_id, user_profile_id, reserved_at, expires_at)
  values
    (v_accession_id, p_book_id, v_me, v_reserved_at, v_expires_at)
  returning id into v_id;

  insert into public.notifications
    (user_profile_id, type, title, message, link)
  values
    (v_me, 'reservation', 'Book held for pickup',
     format('%s (%s) is held for you until %s.', v_book_name, v_accession_number,
            to_char(v_expires_at at time zone 'Asia/Manila', 'Mon DD, YYYY HH12:MI AM')),
     '/my-borrowing');

  return jsonb_build_object(
    'id', v_id,
    'book_id', p_book_id,
    'book_name', v_book_name,
    'accession_id', v_accession_id,
    'accession_number', v_accession_number,
    'reserved_at', v_reserved_at,
    'expires_at', v_expires_at,
    'status', 'active'
  );
end $$;
revoke all on function public.lirc_reserve_book(bigint) from public, anon;
grant execute on function public.lirc_reserve_book(bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- State for one book: current user's eligibility, active copies and holders.
-- Members never see another holder's name; staff do.
-- ---------------------------------------------------------------------------
create or replace function public.lirc_book_reservation_state(p_book_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me bigint := lirc_private.my_profile_id();
  v_staff boolean := lirc_private.library_operator_id() is not null;
  v_status jsonb;
  v_my_reservation jsonb;
  v_reservations jsonb;
begin
  if v_me is null then
    raise exception 'Sign in to view reservations.' using errcode = '42501';
  end if;
  perform lirc_private.expire_book_reservations();
  v_status := lirc_private.book_reservation_status(v_me, p_book_id);

  select jsonb_build_object(
    'id', r.id,
    'accession_id', a.id,
    'accession_number', a.accession_number,
    'status', r.status,
    'reserved_at', r.reserved_at,
    'expires_at', r.expires_at,
    'mine', (r.user_profile_id = v_me),
    'holder', case when v_staff then
      lirc_private.person_name(u.first_name, u.middle_initial, u.surname, u.suffix)
    else null end
  )
  into v_my_reservation
  from public.book_reservations r
  join public.book_accession_numbers a on a.id = r.accession_id
  join public."usersData" u on u.id = r.user_profile_id
  where r.user_profile_id = v_me
    and r.book_id = p_book_id
    and r.status = 'active'
  order by r.expires_at
  limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'accession_id', a.id,
    'accession_number', a.accession_number,
    'mine', (r.user_profile_id = v_me),
    'holder', case when v_staff then
      lirc_private.person_name(u.first_name, u.middle_initial, u.surname, u.suffix)
    else null end,
    'expires_at', r.expires_at
  ) order by r.expires_at, r.id), '[]'::jsonb)
  into v_reservations
  from public.book_reservations r
  join public.book_accession_numbers a on a.id = r.accession_id
  join public."usersData" u on u.id = r.user_profile_id
  where r.book_id = p_book_id
    and r.status = 'active'
    and r.expires_at > now();

  return jsonb_build_object(
    'book_id', p_book_id,
    'is_staff', v_staff,
    'can_reserve', (v_status->>'can_reserve')::boolean,
    'reason', v_status->>'reason',
    'available_count', (v_status->>'available_count')::integer,
    'active_count', (v_status->>'active_count')::integer,
    'max_reservations', 3,
    'my_reservation', v_my_reservation,
    'reservations', v_reservations
  );
end $$;
revoke all on function public.lirc_book_reservation_state(bigint)
  from public, anon;
grant execute on function public.lirc_book_reservation_state(bigint)
  to authenticated;

-- ---------------------------------------------------------------------------
-- The signed-in member's reservations.
-- ---------------------------------------------------------------------------
create or replace function public.lirc_my_reservations()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me bigint := lirc_private.my_profile_id();
  v_active integer;
  v_rows jsonb;
begin
  if v_me is null then
    raise exception 'Sign in to view reservations.' using errcode = '42501';
  end if;
  perform lirc_private.expire_book_reservations();

  select count(*) into v_active
  from public.book_reservations r
  where r.user_profile_id = v_me and r.status = 'active';

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'book_id', r.book_id,
    'book_name', b.book_name,
    'author', b.author,
    'accession_id', a.id,
    'accession_number', a.accession_number,
    'status', r.status,
    'reserved_at', r.reserved_at,
    'expires_at', r.expires_at,
    'fulfilled_at', r.fulfilled_at,
    'cancelled_at', r.cancelled_at,
    'seconds_left', greatest(0, extract(epoch from r.expires_at - now())::integer)
  ) order by case when r.status = 'active' then 0 else 1 end,
             r.reserved_at desc, r.id desc), '[]'::jsonb)
  into v_rows
  from public.book_reservations r
  join public.book_accession_numbers a on a.id = r.accession_id
  join public.books b on b.id = r.book_id
  where r.user_profile_id = v_me
    and r.reserved_at > now() - interval '90 days';

  return jsonb_build_object(
    'active_count', v_active,
    'max_reservations', 3,
    'reservations', v_rows
  );
end $$;
revoke all on function public.lirc_my_reservations() from public, anon;
grant execute on function public.lirc_my_reservations() to authenticated;

-- ---------------------------------------------------------------------------
-- Staff queue of active holds.
-- ---------------------------------------------------------------------------
create or replace function public.lirc_staff_reservations()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows jsonb;
  v_count integer;
begin
  if lirc_private.library_operator_id() is null then
    raise exception 'Library staff access required.' using errcode = '42501';
  end if;
  perform lirc_private.expire_book_reservations();

  select count(*)::integer into v_count
  from public.book_reservations r
  where r.status = 'active' and r.expires_at > now();

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'book_id', r.book_id,
    'book_name', b.book_name,
    'author', b.author,
    'accession_number', a.accession_number,
    'member', lirc_private.person_name(u.first_name, u.middle_initial, u.surname, u.suffix),
    'library_id', u.library_id,
    'role', u.role,
    'reserved_at', r.reserved_at,
    'expires_at', r.expires_at,
    'seconds_left', greatest(0, extract(epoch from r.expires_at - now())::integer)
  ) order by r.expires_at, r.id), '[]'::jsonb)
  into v_rows
  from public.book_reservations r
  join public.book_accession_numbers a on a.id = r.accession_id
  join public.books b on b.id = r.book_id
  join public."usersData" u on u.id = r.user_profile_id
  where r.status = 'active' and r.expires_at > now();

  return jsonb_build_object('count', v_count, 'reservations', v_rows);
end $$;
revoke all on function public.lirc_staff_reservations() from public, anon;
grant execute on function public.lirc_staff_reservations() to authenticated;

-- ---------------------------------------------------------------------------
-- Cancel a hold: the owner or library staff.
-- ---------------------------------------------------------------------------
create or replace function public.lirc_cancel_book_reservation(p_reservation_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me bigint := lirc_private.my_profile_id();
  v_staff boolean := lirc_private.library_operator_id() is not null;
  v_req public.book_reservations%ROWTYPE;
begin
  if v_me is null then
    raise exception 'Sign in to cancel a reservation.' using errcode = '42501';
  end if;
  perform lirc_private.expire_book_reservations();
  select * into v_req
  from public.book_reservations
  where id = p_reservation_id
  for update;
  if not found or v_req.status <> 'active' then
    raise exception 'This reservation is no longer active.';
  end if;
  if not v_staff and v_req.user_profile_id <> v_me then
    raise exception 'You can only cancel your own reservation.' using errcode = '42501';
  end if;

  update public.book_reservations
     set status = 'cancelled',
         cancelled_by = v_me,
         cancelled_at = now()
   where id = p_reservation_id;

  return jsonb_build_object('ok', true, 'status', 'cancelled');
end $$;
revoke all on function public.lirc_cancel_book_reservation(bigint)
  from public, anon;
grant execute on function public.lirc_cancel_book_reservation(bigint)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Borrow trigger: enforce the exact copy and fulfil the hold on pickup.
-- The existing borrow RPCs and the station all insert book_loans, so this
-- applies to every borrowing path without duplicating the large RPCs.
-- ---------------------------------------------------------------------------
create or replace function lirc_private.guard_book_reservation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_res public.book_reservations%ROWTYPE;
begin
  if NEW.returned_at is not null then
    return NEW;
  end if;
  -- Serialize with a reservation choosing this accession. Without this lock a
  -- loan and a new hold could both see the copy as free.
  perform 1
  from public.book_accession_numbers
  where id = NEW.accession_id
  for update;
  perform lirc_private.expire_book_reservations();
  select * into v_res
  from public.book_reservations
  where accession_id = NEW.accession_id
    and status = 'active'
  order by expires_at
  limit 1
  for update;
  if found and v_res.user_profile_id <> NEW.user_profile_id then
    raise exception 'This copy is reserved for another member until %.',
      to_char(v_res.expires_at at time zone 'Asia/Manila', 'Mon DD, YYYY HH12:MI AM');
  end if;
  return NEW;
end $$;
revoke all on function lirc_private.guard_book_reservation()
  from public, anon, authenticated;

create or replace function lirc_private.fulfil_book_reservation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if NEW.returned_at is not null then
    return NEW;
  end if;
  update public.book_reservations
     set status = 'fulfilled',
         fulfilled_loan_id = NEW.id,
         fulfilled_at = now()
   where accession_id = NEW.accession_id
     and user_profile_id = NEW.user_profile_id
     and status = 'active';
  return NEW;
end $$;
revoke all on function lirc_private.fulfil_book_reservation()
  from public, anon, authenticated;

drop trigger if exists lirc_guard_book_reservation on public.book_loans;
create trigger lirc_guard_book_reservation
  before insert on public.book_loans
  for each row execute function lirc_private.guard_book_reservation();

drop trigger if exists lirc_fulfil_book_reservation on public.book_loans;
create trigger lirc_fulfil_book_reservation
  after insert on public.book_loans
  for each row execute function lirc_private.fulfil_book_reservation();

notify pgrst, 'reload schema';
commit;
