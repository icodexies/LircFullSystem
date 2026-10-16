-- My Borrowing: a member's own circulation records.
--
-- Students, faculty, staff and non-teaching personnel read their own loans —
-- still out, overdue, and returned — with server-side status filter, search
-- (book title, author or accession number) and paging. The payload only ever
-- contains the caller's own rows; totals are all-time.
-- ============================================================================
begin;

create or replace function public.lirc_my_loans(
  p_status text default 'all',
  p_search text default '',
  p_limit int default 20,
  p_offset int default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me public."usersData"%ROWTYPE;
  v_status text := lower(btrim(coalesce(p_status, 'all')));
  v_search text := btrim(coalesce(p_search, ''));
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 100);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
begin
  select * into v_me from public."usersData"
  where id = lirc_private.my_profile_id();
  if not found then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if v_status not in ('all', 'open', 'overdue', 'returned') then
    raise exception 'Unknown status filter.';
  end if;

  return jsonb_build_object(
    'totals', jsonb_build_object(
      'all', (
        select count(*) from public.book_loans l
        where l.user_profile_id = v_me.id),
      'open', (
        select count(*) from public.book_loans l
        where l.user_profile_id = v_me.id and l.returned_at is null),
      'overdue', (
        select count(*) from public.book_loans l
        where l.user_profile_id = v_me.id
          and l.returned_at is null and l.due_at < now()),
      'returned', (
        select count(*) from public.book_loans l
        where l.user_profile_id = v_me.id and l.returned_at is not null),
      'late_returns', (
        select count(*) from public.book_loans l
        where l.user_profile_id = v_me.id
          and l.returned_at is not null and l.returned_at > l.due_at)),
    'total', (
      select count(*)
      from public.book_loans l
      join public.book_accession_numbers a on a.id = l.accession_id
      join public.books b on b.id = a.book_id
      where l.user_profile_id = v_me.id
        and (v_status = 'all'
             or (v_status = 'open' and l.returned_at is null)
             or (v_status = 'overdue'
                 and l.returned_at is null and l.due_at < now())
             or (v_status = 'returned' and l.returned_at is not null))
        and (v_search = ''
             or b.book_name ilike '%' || v_search || '%'
             or b.author ilike '%' || v_search || '%'
             or a.accession_number ilike '%' || v_search || '%')),
    'rows', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', x.id,
          'book_id', x.book_id,
          'book_name', x.book_name,
          'author', x.author,
          'call_number', x.call_number,
          'accession_number', x.accession_number,
          'borrowed_at', x.borrowed_at,
          'due_at', x.due_at,
          'returned_at', x.returned_at,
          'is_overdue', x.is_overdue,
          'days_overdue', x.days_overdue,
          'days_late', x.days_late)
          order by x.borrowed_at desc, x.id desc), '[]'::jsonb)
      from (
        select l.id, b.id as book_id, b.book_name, b.author, b.call_number,
               a.accession_number,
               l.borrowed_at, l.due_at, l.returned_at,
               (l.returned_at is null and l.due_at < now()) as is_overdue,
               case when l.returned_at is null and l.due_at < now()
                    then floor(extract(epoch from (now() - l.due_at)) / 86400)::int
               end as days_overdue,
               case when l.returned_at is not null and l.returned_at > l.due_at
                    then floor(extract(epoch from (l.returned_at - l.due_at))
                               / 86400)::int
               end as days_late
        from public.book_loans l
        join public.book_accession_numbers a on a.id = l.accession_id
        join public.books b on b.id = a.book_id
        where l.user_profile_id = v_me.id
          and (v_status = 'all'
               or (v_status = 'open' and l.returned_at is null)
               or (v_status = 'overdue'
                   and l.returned_at is null and l.due_at < now())
               or (v_status = 'returned' and l.returned_at is not null))
          and (v_search = ''
               or b.book_name ilike '%' || v_search || '%'
               or b.author ilike '%' || v_search || '%'
               or a.accession_number ilike '%' || v_search || '%')
        order by l.borrowed_at desc, l.id desc
        limit v_limit offset v_offset) x));
end $$;

revoke all on function public.lirc_my_loans(text, text, int, int)
  from public, anon, authenticated;
grant execute on function public.lirc_my_loans(text, text, int, int)
  to authenticated;

notify pgrst, 'reload schema';
commit;
