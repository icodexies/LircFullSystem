-- Overdue records: alphabetical by book title (case-insensitive), across all pages.
-- Other scopes keep their existing newest/most-recent ordering.
begin;
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
  ) order by case when v_scope = 'overdue' then lower(y.book_name) end asc nulls last,
             case when v_scope = 'overdue' then y.book_id end asc,
             case when v_scope = 'overdue' then y.id end asc,
             case when v_scope <> 'overdue' then y.sort_recent end desc nulls last,
             case when v_scope <> 'overdue' then y.id end desc), '[]'::jsonb)
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
    order by case when v_scope = 'overdue' then lower(b.book_name) end asc nulls last,
             case when v_scope = 'overdue' then b.id end asc,
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