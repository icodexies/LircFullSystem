-- ============================================================================
-- Person status + today's attendance totals
--
-- 1) usersData.person_status — an optional classification for people who can
--    no longer be reached (retired, resigned, separated from the school, on
--    leave, or deceased). Nullable: null means "not specified". Students keep
--    their enrollment status; this field is available to anyone the library
--    needs to flag.
--
--    Workflow: Users → open a member → Edit details → Person status. Admins
--    apply the change immediately; staff/librarian edits go through the
--    existing admin-approval request flow. The status is shown on the member
--    record, the Borrowed/Overdue/Returned lists, the borrow Report tab and
--    its Excel export.
--
-- 2) The attendance report summary now returns today's time-ins and
--    time-outs (Philippine time), so the Attendance page card can show the
--    day's totals instead of the average stay.
--
-- Apply after 20261021100000_fix_borrow_preview_format.sql.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- Column
-- ---------------------------------------------------------------------------
alter table public."usersData" add column if not exists person_status text;

alter table public."usersData"
  drop constraint if exists usersData_person_status_check;
alter table public."usersData"
  add constraint usersData_person_status_check
  check (person_status is null or person_status in
    ('active', 'on_leave', 'retired', 'resigned', 'separated', 'deceased'));

comment on column public."usersData".person_status is
  'Optional person status: active/on_leave/retired/resigned/separated/deceased. Null = not specified. Mainly for personnel; students also keep their enrollment status.';

-- ---------------------------------------------------------------------------
-- Member edits: accept, validate and save the status
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
                    'department_id','program_id','position_classification_id',
                    'person_status')
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
  if p_changes ? 'person_status' then
    v := lower(btrim(coalesce(p_changes->>'person_status', '')));
    if v <> '' and v not in
      ('active','on_leave','retired','resigned','separated','deceased') then
      raise exception 'Choose a valid person status.';
    end if;
    if nullif(v, '') is distinct from
       nullif(lower(btrim(coalesce(u.person_status, ''))), '') then
      result := result || jsonb_build_object('person_status', nullif(v, ''));
    end if;
  end if;
  return result;
end $$;
revoke all on function lirc_private.sanitize_member_changes(jsonb,bigint) from public, anon, authenticated;

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
  if p_changes ? 'person_status' then
    parts := parts || format('person_status = %L', nullif(lower(btrim(p_changes->>'person_status')), ''));
  end if;
  if array_length(parts, 1) is null then
    raise exception 'Nothing to change.';
  end if;
  execute 'update public."usersData" set ' || array_to_string(parts, ', ')
       || ' where id = ' || p_profile::text;
end $$;
revoke all on function lirc_private.apply_member_change(bigint,jsonb) from public, anon, authenticated;

-- Requesting an edit also records the previous status for the approval view.
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

  select lirc_private.person_name(u.first_name, u.middle_initial, u.surname, u.suffix), u.library_id,
         jsonb_build_object(
           'first_name', u.first_name, 'surname', u.surname,
           'middle_initial', u.middle_initial, 'suffix', u.suffix,
           'department_id', u.department_id, 'program_id', u.program_id,
           'position_classification_id', u.position_classification_id,
           'person_status', u.person_status)
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
-- Member profile (Users page): expose the status
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
    'full_name', lirc_private.person_name(u.first_name, u.middle_initial, u.surname, u.suffix),
    'first_name', u.first_name,
    'surname', u.surname,
    'middle_initial', u.middle_initial,
    'suffix', u.suffix,
    'library_id', u.library_id,
    'role', u.role,
    'person_status', u.person_status,
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
-- Attendance summary: today's time-ins and time-outs (Philippine time)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_attendance_report(p_semester_id bigint,p_filters jsonb default '{}'::jsonb,p_page integer default 1,p_page_size integer default 20,p_open_across_semesters boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; ordering text; direction text;
begin
 if lirc_private.attendance_staff_id() is null then raise exception 'Staff access required.' using errcode='42501'; end if;
 if p_semester_id is null or not exists(select 1 from public.semesters where id=p_semester_id) then raise exception 'A valid selected period is required.'; end if;
 if p_page<1 or p_page>1000000 or p_page_size<1 or p_page_size>100 then raise exception 'Invalid report page.'; end if;
 if jsonb_typeof(p_filters)<>'object' then raise exception 'Invalid filters.'; end if;
 if coalesce(p_filters->>'search_by','full_name') not in ('full_name','library_id','first_name','surname','middle_initial','suffix') then raise exception 'Invalid search field.'; end if;
 ordering:=case coalesce(p_filters->>'sort','arrival') when 'arrival' then '(r->>''time_in'')::timestamptz' when 'departure' then '(r->>''time_out'')::timestamptz' when 'created' then '(r->>''created_at'')::timestamptz' when 'name' then 'r->>''full_name''' when 'card' then 'r->>''library_id''' when 'year_level' then '(r->>''year_level'')::int' when 'duration' then '(r->>''duration'')::numeric' else null end;
 if ordering is null then raise exception 'Invalid sort.'; end if;
 direction:=case coalesce(p_filters->>'direction','desc') when 'asc' then 'asc' when 'desc' then 'desc' else null end;
 if direction is null then raise exception 'Invalid sort direction.'; end if;
 execute format($query$
  with filtered as materialized (select r from lirc_private.filtered_attendance($1,$2,$5) r),
  page as (select r from filtered order by %s %s nulls last,(r->>'id')::bigint %s limit $3 offset $4)
  select jsonb_build_object('rows',coalesce((select jsonb_agg(r) from page),'[]'::jsonb),
   'summary',(select jsonb_build_object(
     'total',count(*),
     'unique_visitors',count(distinct r->>'user_profile_id'),
     'inside',count(*) filter(where r->>'time_out' is null),
     'average_duration',avg((r->>'duration')::numeric),
     'today_time_ins',count(*) filter(where ((r->>'time_in')::timestamptz at time zone 'Asia/Manila')::date = (now() at time zone 'Asia/Manila')::date),
     'today_time_outs',count(*) filter(where r->>'time_out' is not null and ((r->>'time_out')::timestamptz at time zone 'Asia/Manila')::date = (now() at time zone 'Asia/Manila')::date)
   ) from filtered),
   'has_next',(select count(*) from filtered)>$4+$3,'as_of',now())
  $query$,ordering,direction,direction) into result using p_semester_id,p_filters,p_page_size,(p_page::bigint-1)*p_page_size,p_open_across_semesters;
 return result;
end $$;

-- ---------------------------------------------------------------------------
-- Borrow report rows: the borrower's status travels with each loan
-- (the OUT row gains a column, so the function is dropped and re-created)
-- ---------------------------------------------------------------------------
drop function if exists lirc_private.borrow_report_rows(jsonb);

create or replace function lirc_private.borrow_report_rows(p_filters jsonb)
returns table (
  id bigint,
  user_profile_id bigint,
  member_name text,
  library_id text,
  role text,
  person_status text,
  avatar_url text,
  department text,
  program text,
  book_name text,
  author text,
  call_number text,
  accession_number text,
  borrowed_at timestamptz,
  due_at timestamptz,
  returned_at timestamptz,
  is_overdue boolean,
  days_overdue integer,
  days_late integer,
  days_kept integer,
  recorded_by_name text,
  returned_by_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_role text;
  v_search_by text;
  v_search text;
  v_words text[];
  v_borrowed_from timestamptz;
  v_borrowed_to timestamptz;
  v_due_from timestamptz;
  v_due_to timestamptz;
  v_returned_from timestamptz;
  v_returned_to timestamptz;
begin
  if p_filters is null or jsonb_typeof(p_filters) <> 'object' then
    raise exception 'Invalid filters.';
  end if;

  v_status := lower(btrim(coalesce(p_filters ->> 'status', '')));
  if v_status not in ('', 'open', 'overdue', 'returned', 'late') then
    raise exception 'Invalid status filter.';
  end if;
  v_search_by := lower(btrim(coalesce(p_filters ->> 'search_by', 'member')));
  if v_search_by not in ('member', 'book') then
    raise exception 'Invalid search field.';
  end if;
  v_role := lower(btrim(coalesce(p_filters ->> 'role', '')));
  v_search := btrim(coalesce(p_filters ->> 'search', ''));
  if length(v_search) > 120 then
    raise exception 'Keep the search under 120 characters.';
  end if;
  v_words := array(
    select replace(replace(replace(lower(w), '\', '\\'), '%', '\%'), '_', '\_')
    from unnest(regexp_split_to_array(v_search, '\s+')) as w
    where w <> ''
  );

  v_borrowed_from := lirc_private.parse_ts(p_filters ->> 'borrowed_from');
  v_borrowed_to := lirc_private.parse_ts(p_filters ->> 'borrowed_to');
  v_due_from := lirc_private.parse_ts(p_filters ->> 'due_from');
  v_due_to := lirc_private.parse_ts(p_filters ->> 'due_to');
  v_returned_from := lirc_private.parse_ts(p_filters ->> 'returned_from');
  v_returned_to := lirc_private.parse_ts(p_filters ->> 'returned_to');

  return query
  select
    l.id,
    l.user_profile_id,
    concat_ws(' ', u.first_name,
              nullif(btrim(coalesce(u.middle_initial, '')), ''),
              u.surname,
              nullif(btrim(coalesce(u.suffix, '')), '')) as member_name,
    u.library_id,
    lower(btrim(u.role::text)) as role,
    u.person_status,
    u.avatar_url,
    d.name as department,
    p.name as program,
    b.book_name,
    b.author,
    b.call_number,
    a.accession_number,
    l.borrowed_at,
    l.due_at,
    l.returned_at,
    (l.returned_at is null and l.due_at < now()) as is_overdue,
    case when l.returned_at is null and l.due_at < now()
         then floor(extract(epoch from (now() - l.due_at)) / 86400)::int end as days_overdue,
    case when l.returned_at is not null and l.returned_at > l.due_at
         then floor(extract(epoch from (l.returned_at - l.due_at)) / 86400)::int end as days_late,
    case when l.returned_at is not null
         then floor(extract(epoch from (l.returned_at - l.borrowed_at)) / 86400)::int end as days_kept,
    (select concat_ws(' ', op.first_name, op.surname)
       from public."usersData" op where op.id = l.recorded_by) as recorded_by_name,
    (select concat_ws(' ', op.first_name, op.surname)
       from public."usersData" op where op.id = l.returned_by) as returned_by_name
  from public.book_loans l
  join public.book_accession_numbers a on a.id = l.accession_id
  join public.books b on b.id = a.book_id
  join public."usersData" u on u.id = l.user_profile_id
  left join public.departments d on d.id = u.department_id
  left join public.programs p on p.id = u.program_id
  where (v_borrowed_from is null or l.borrowed_at >= v_borrowed_from)
    and (v_borrowed_to is null or l.borrowed_at < v_borrowed_to)
    and (v_due_from is null or l.due_at >= v_due_from)
    and (v_due_to is null or l.due_at < v_due_to)
    and (v_returned_from is null
         or (l.returned_at is not null and l.returned_at >= v_returned_from))
    and (v_returned_to is null
         or (l.returned_at is not null and l.returned_at < v_returned_to))
    and (v_status = ''
         or (v_status = 'open' and l.returned_at is null)
         or (v_status = 'overdue' and l.returned_at is null and l.due_at < now())
         or (v_status = 'returned' and l.returned_at is not null)
         or (v_status = 'late' and l.returned_at is not null and l.returned_at > l.due_at))
    and (v_role = '' or lower(btrim(u.role::text)) = v_role)
    and (cardinality(v_words) = 0
         or (case v_search_by
               when 'book' then
                 not exists (select 1 from unnest(v_words) w
                             where b.book_name not ilike '%' || w || '%'
                               and a.accession_number not ilike '%' || w || '%')
               else
                 not exists (select 1 from unnest(v_words) w
                             where u.library_id not ilike '%' || w || '%'
                               and concat_ws(' ', u.first_name, u.middle_initial,
                                             u.surname, u.suffix) not ilike '%' || w || '%')
             end));
end;
$$;
revoke all on function lirc_private.borrow_report_rows(jsonb) from public, anon, authenticated;

create or replace function public.lirc_borrow_report(
  p_filters jsonb default '{}'::jsonb,
  p_page integer default 1,
  p_page_size integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_page integer;
  v_size integer;
  v_offset integer;
  v_sort text;
  v_direction text;
begin
  if lirc_private.library_operator_id() is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  v_page := greatest(1, coalesce(p_page, 1));
  v_size := least(100, greatest(1, coalesce(p_page_size, 20)));
  v_offset := (v_page - 1) * v_size;
  v_sort := lower(btrim(coalesce(p_filters ->> 'sort', 'borrowed')));
  if v_sort not in ('borrowed', 'due', 'returned', 'member', 'book') then
    raise exception 'Invalid sort.';
  end if;
  v_direction := lower(btrim(coalesce(p_filters ->> 'direction', 'desc')));
  if v_direction not in ('asc', 'desc') then
    raise exception 'Invalid direction.';
  end if;

  return (
    with base as (
      select * from lirc_private.borrow_report_rows(p_filters)
    )
    select jsonb_build_object(
      'rows', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id,
          'member_id', p.user_profile_id,
          'member_name', p.member_name,
          'library_id', p.library_id,
          'role', p.role,
          'person_status', p.person_status,
          'avatar_url', p.avatar_url,
          'department', p.department,
          'program', p.program,
          'book_name', p.book_name,
          'author', p.author,
          'call_number', p.call_number,
          'accession_number', p.accession_number,
          'borrowed_at', p.borrowed_at,
          'due_at', p.due_at,
          'returned_at', p.returned_at,
          'is_overdue', p.is_overdue,
          'days_overdue', p.days_overdue,
          'days_late', p.days_late,
          'days_kept', p.days_kept,
          'recorded_by_name', p.recorded_by_name,
          'returned_by_name', p.returned_by_name))
        from (
          select * from base
          order by
            case when v_sort = 'borrowed' and v_direction = 'asc' then borrowed_at end asc nulls last,
            case when v_sort = 'borrowed' and v_direction = 'desc' then borrowed_at end desc nulls last,
            case when v_sort = 'due' and v_direction = 'asc' then due_at end asc nulls last,
            case when v_sort = 'due' and v_direction = 'desc' then due_at end desc nulls last,
            case when v_sort = 'returned' and v_direction = 'asc' then returned_at end asc nulls last,
            case when v_sort = 'returned' and v_direction = 'desc' then returned_at end desc nulls last,
            case when v_sort = 'member' and v_direction = 'asc' then member_name end asc nulls last,
            case when v_sort = 'member' and v_direction = 'desc' then member_name end desc nulls last,
            case when v_sort = 'book' and v_direction = 'asc' then book_name end asc nulls last,
            case when v_sort = 'book' and v_direction = 'desc' then book_name end desc nulls last,
            borrowed_at desc, id desc
          limit v_size offset v_offset
        ) p
      ), '[]'::jsonb),
      'total', (select count(*) from base),
      'has_next', (select count(*) from base) > v_offset + v_size,
      'summary', (select jsonb_build_object(
        'total', count(*),
        'open', count(*) filter (where returned_at is null),
        'overdue', count(*) filter (where returned_at is null and due_at < now()),
        'returned', count(*) filter (where returned_at is not null),
        'late', count(*) filter (where returned_at is not null and returned_at > due_at),
        'on_time', count(*) filter (where returned_at is not null and returned_at <= due_at),
        'unique_members', count(distinct user_profile_id),
        'avg_days_kept', round(avg(extract(epoch from (returned_at - borrowed_at)) / 86400.0)
                               filter (where returned_at is not null), 1)
      ) from base)
    )
  );
end;
$$;

create or replace function public.lirc_borrow_report_export(
  p_filters jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if lirc_private.library_operator_id() is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'member_id', p.user_profile_id,
        'member_name', p.member_name,
        'library_id', p.library_id,
        'role', p.role,
        'person_status', p.person_status,
        'department', p.department,
        'program', p.program,
        'book_name', p.book_name,
        'author', p.author,
        'call_number', p.call_number,
        'accession_number', p.accession_number,
        'borrowed_at', p.borrowed_at,
        'due_at', p.due_at,
        'returned_at', p.returned_at,
        'is_overdue', p.is_overdue,
        'days_overdue', p.days_overdue,
        'days_late', p.days_late,
        'days_kept', p.days_kept,
        'recorded_by_name', p.recorded_by_name,
        'returned_by_name', p.returned_by_name))
      from (
        select * from lirc_private.borrow_report_rows(p_filters)
        order by borrowed_at desc, id desc
      ) p
    ), '[]'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- Borrowed / Overdue / Returned lists: include the status
-- ---------------------------------------------------------------------------
create or replace function public.lirc_loan_records(
  p_scope text default 'borrowed',
  p_filters jsonb default '{}'::jsonb,
  p_page integer default 1,
  p_page_size integer default 20)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_scope text := lower(btrim(coalesce(p_scope, 'borrowed')));
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_size integer := least(greatest(coalesce(p_page_size, 20), 1), 100);
  v_member_search text := nullif(btrim(coalesce(p_filters ->> 'member_search', '')), '');
  v_role text := nullif(lower(btrim(coalesce(p_filters ->> 'role', ''))), '');
  v_book_search text := nullif(btrim(coalesce(p_filters ->> 'book_search', '')), '');
  v_words text[];
  v_from timestamptz := nullif(p_filters ->> 'from', '')::timestamptz;
  v_to timestamptz := nullif(p_filters ->> 'to', '')::timestamptz;
  v_total bigint;
  v_rows jsonb;
  v_count_borrowed bigint;
  v_count_overdue bigint;
  v_count_returned bigint;
begin
  if lirc_private.library_operator_id() is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  if v_scope not in ('borrowed', 'overdue', 'returned') then
    raise exception 'Unknown list. Use borrowed, overdue or returned.';
  end if;
  if v_member_search is not null then
    if char_length(v_member_search) > 120 then
      v_member_search := left(v_member_search, 120);
    end if;
    v_words := regexp_split_to_array(lower(v_member_search), '\s+');
  end if;

  select count(*) filter (where l.returned_at is null),
         count(*) filter (where l.returned_at is null and l.due_at < now()),
         count(*) filter (where l.returned_at is not null)
    into v_count_borrowed, v_count_overdue, v_count_returned
  from public.book_loans l
  join public."usersData" u on u.id = l.user_profile_id
  join public.book_accession_numbers a on a.id = l.accession_id
  join public.books b on b.id = a.book_id
  where (v_member_search is null or (
          lower(u.library_id) like lower(v_member_search) || '%'
          or not exists (
            select 1 from unnest(v_words) as w
            where w <> ''
              and lirc_private.person_name(u.first_name, u.middle_initial, u.surname, u.suffix) not ilike '%' || w || '%')
          or extensions.word_similarity(
               lower(v_member_search),
               lower(concat_ws(' ', u.first_name, u.middle_initial,
                               u.surname, u.suffix))) > 0.6))
    and (v_role is null or lower(btrim(u.role::text)) = v_role)
    and (v_book_search is null
         or b.book_name ilike '%' || v_book_search || '%'
         or lower(a.accession_number) like lower(v_book_search) || '%');

  select count(*) into v_total
  from public.book_loans l
  join public."usersData" u on u.id = l.user_profile_id
  join public.book_accession_numbers a on a.id = l.accession_id
  join public.books b on b.id = a.book_id
  where (v_scope <> 'borrowed' or l.returned_at is null)
    and (v_scope <> 'overdue'
         or (l.returned_at is null and l.due_at < now()))
    and (v_scope <> 'returned' or l.returned_at is not null)
    and (v_member_search is null or (
          lower(u.library_id) like lower(v_member_search) || '%'
          or not exists (
            select 1 from unnest(v_words) as w
            where w <> ''
              and lirc_private.person_name(u.first_name, u.middle_initial, u.surname, u.suffix) not ilike '%' || w || '%')
          or extensions.word_similarity(
               lower(v_member_search),
               lower(concat_ws(' ', u.first_name, u.middle_initial,
                               u.surname, u.suffix))) > 0.6))
    and (v_role is null or lower(btrim(u.role::text)) = v_role)
    and (v_book_search is null
         or b.book_name ilike '%' || v_book_search || '%'
         or lower(a.accession_number) like lower(v_book_search) || '%')
    and (v_from is null
         or (case when v_scope = 'returned'
                  then l.returned_at else l.borrowed_at end) >= v_from)
    and (v_to is null
         or (case when v_scope = 'returned'
                  then l.returned_at else l.borrowed_at end) < v_to);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', y.id,
    'book_id', y.book_id,
    'book_name', y.book_name,
    'author', y.author,
    'call_number', y.call_number,
    'accession_number', y.accession_number,
    'member_id', y.member_id,
    'member_name', y.member_name,
    'library_id', y.library_id,
    'role', y.role,
    'person_status', y.person_status,
    'avatar_url', y.avatar_url,
    'borrowed_at', y.borrowed_at,
    'due_at', y.due_at,
    'returned_at', y.returned_at,
    'recorded_by', y.recorded_by,
    'returned_by', y.returned_by,
    'is_overdue', y.is_overdue,
    'days_overdue', y.days_overdue,
    'days_late', y.days_late
  ) order by y.sort_due asc nulls last,
             case when v_scope = 'overdue' then y.sort_id end asc,
             y.sort_recent desc nulls last,
             case when v_scope <> 'overdue' then y.sort_id end desc), '[]'::jsonb)
  into v_rows
  from (
    select l.id, b.id as book_id, b.book_name, b.author, b.call_number,
      a.accession_number,
      u.id as member_id,
      lirc_private.person_name(u.first_name, u.middle_initial, u.surname, u.suffix)
        as member_name,
      u.library_id, u.role, u.person_status, u.avatar_url,
      l.borrowed_at, l.due_at, l.returned_at,
      (select lirc_private.person_name(op.first_name, op.middle_initial, op.surname, op.suffix)
         from public."usersData" op where op.id = l.recorded_by) as recorded_by,
      (select lirc_private.person_name(op.first_name, op.middle_initial, op.surname, op.suffix)
         from public."usersData" op where op.id = l.returned_by) as returned_by,
      (l.returned_at is null and l.due_at < now()) as is_overdue,
      case when l.returned_at is null and l.due_at < now()
           then floor(extract(epoch from (now() - l.due_at)) / 86400)::int
           end as days_overdue,
      case when l.returned_at is not null and l.returned_at > l.due_at
           then floor(extract(epoch from (l.returned_at - l.due_at)) / 86400)::int
           end as days_late,
      case when v_scope = 'overdue' then l.due_at end as sort_due,
      l.id as sort_id,
      case when v_scope <> 'overdue'
           then coalesce(l.returned_at, l.borrowed_at) end as sort_recent
    from public.book_loans l
    join public."usersData" u on u.id = l.user_profile_id
    join public.book_accession_numbers a on a.id = l.accession_id
    join public.books b on b.id = a.book_id
    where (v_scope <> 'borrowed' or l.returned_at is null)
      and (v_scope <> 'overdue'
           or (l.returned_at is null and l.due_at < now()))
      and (v_scope <> 'returned' or l.returned_at is not null)
      and (v_member_search is null or (
            lower(u.library_id) like lower(v_member_search) || '%'
            or not exists (
              select 1 from unnest(v_words) as w
              where w <> ''
                and lirc_private.person_name(u.first_name, u.middle_initial, u.surname, u.suffix) not ilike '%' || w || '%')
            or extensions.word_similarity(
                 lower(v_member_search),
                 lower(concat_ws(' ', u.first_name, u.middle_initial,
                                 u.surname, u.suffix))) > 0.6))
      and (v_role is null or lower(btrim(u.role::text)) = v_role)
      and (v_book_search is null
           or b.book_name ilike '%' || v_book_search || '%'
           or lower(a.accession_number) like lower(v_book_search) || '%')
      and (v_from is null
           or (case when v_scope = 'returned'
                    then l.returned_at else l.borrowed_at end) >= v_from)
      and (v_to is null
           or (case when v_scope = 'returned'
                    then l.returned_at else l.borrowed_at end) < v_to)
    order by case when v_scope = 'overdue' then l.due_at end asc nulls last,
             case when v_scope = 'overdue' then l.id end asc,
             case when v_scope <> 'overdue'
                  then coalesce(l.returned_at, l.borrowed_at) end desc nulls last,
             case when v_scope <> 'overdue' then l.id end desc
    limit v_size offset (v_page - 1) * v_size
  ) y;

  return jsonb_build_object(
    'rows', v_rows,
    'total', v_total,
    'page', v_page,
    'page_size', v_size,
    'pages', greatest(ceil(v_total::numeric / v_size), 1),
    'has_prev', v_page > 1,
    'has_next', (v_page * v_size) < v_total,
    'counts', jsonb_build_object(
      'borrowed', v_count_borrowed,
      'overdue', v_count_overdue,
      'returned', v_count_returned));
end $$;

commit;
