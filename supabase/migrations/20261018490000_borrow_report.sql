-- ============================================================================
-- Book Borrow report: the detailed, filterable report behind the Report tab
-- in Book Borrow, and its Excel export.
--
--   lirc_borrow_report        - one page of loans + totals + a summary
--   lirc_borrow_report_export - every matching loan in one call (the Excel
--                               job reads this instead of paging)
--
-- Filters (all optional): borrowed_from / borrowed_to, due_from / due_to,
-- returned_from / returned_to (ISO timestamps; the client converts Philippine
-- days), status (open / overdue / returned / late), role, search + search_by
-- (member | book), sort (borrowed / due / returned / member / book) and
-- direction (asc / desc). Library operators only.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- Internal: parse an ISO timestamp filter, with a friendly error.
-- ---------------------------------------------------------------------------
create or replace function lirc_private.parse_ts(p_value text)
returns timestamptz
language plpgsql
stable
as $$
begin
  if p_value is null or btrim(p_value) = '' then
    return null;
  end if;
  return btrim(p_value)::timestamptz;
exception when others then
  raise exception 'Invalid date filter.';
end;
$$;
revoke all on function lirc_private.parse_ts(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Internal: the filtered loan rows (the shared body of the two RPCs).
-- ---------------------------------------------------------------------------
create or replace function lirc_private.borrow_report_rows(p_filters jsonb)
returns table (
  id bigint,
  user_profile_id bigint,
  member_name text,
  library_id text,
  role text,
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

-- ---------------------------------------------------------------------------
-- RPC: one page of the borrow report + totals + summary
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- RPC: every matching loan in one call (the Excel export reads this)
-- ---------------------------------------------------------------------------
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
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function public.lirc_borrow_report(jsonb, integer, integer) from public, anon, authenticated;
revoke all on function public.lirc_borrow_report_export(jsonb) from public, anon, authenticated;
grant execute on function public.lirc_borrow_report(jsonb, integer, integer),
  public.lirc_borrow_report_export(jsonb)
  to authenticated;

commit;
