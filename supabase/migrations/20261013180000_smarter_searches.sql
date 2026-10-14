-- Smarter searches: typing several words finds records even when the words
-- are not next to each other — for example "mark ian dagos" now finds
-- "Mark Ian D. Dagos" (the middle initial no longer blocks the match).
-- Member searches also fall back to similar names (small typos) when nothing
-- matches exactly.
begin;

-- ---------------------------------------------------------------------------
-- Members (Users page + borrow card lookup): every word must appear in the
-- name, in any order; then a similarity fallback for typos.
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
  v_words text[];
  result jsonb;
begin
  if lirc_private.library_operator_id() is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  v_search := btrim(coalesce(p_search, ''));
  if v_search = '' or length(v_search) > 120 then
    raise exception 'Type a name or library card.';
  end if;

  select coalesce(array_agg(w), '{}') into v_words
  from unnest(regexp_split_to_array(lower(v_search), '\s+')) as w
  where w <> '';

  -- 1) Exact card, or every word appears somewhere in the name (any order).
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
    where lower(u.library_id) = lower(v_search)
       or not exists (
         select 1 from unnest(v_words) as w
         where concat_ws(' ', u.first_name, u.middle_initial, u.surname, u.suffix)
               not ilike '%' || w || '%'
       )
    order by u.surname, u.id
    limit 10
  ) x;

  -- 2) Nothing found: try similar names (typos, spelling variants).
  if result->'members' = '[]'::jsonb then
    select jsonb_build_object('members', coalesce(jsonb_agg(jsonb_build_object(
        'id', x.id,
        'full_name', x.full_name,
        'library_id', x.library_id,
        'role', x.role,
        'active_loans', x.active_loans,
        'overdue_loans', x.overdue_loans
      ) order by x.similarity desc, x.surname, x.id), '[]'::jsonb))
    into result
    from (
      select u.id,
        concat_ws(' ', u.first_name, u.middle_initial, u.surname, u.suffix) as full_name,
        u.library_id, u.role, u.surname,
        extensions.word_similarity(
          lower(v_search),
          lower(concat_ws(' ', u.first_name, u.middle_initial, u.surname, u.suffix))) as similarity,
        (select count(*) from public.book_loans l
          where l.user_profile_id = u.id and l.returned_at is null) as active_loans,
        (select count(*) from public.book_loans l
          where l.user_profile_id = u.id and l.returned_at is null and l.due_at < now()) as overdue_loans
      from public."usersData" u
      where extensions.word_similarity(
              lower(v_search),
              lower(concat_ws(' ', u.first_name, u.middle_initial, u.surname, u.suffix))) > 0.6
      order by similarity desc, u.surname, u.id
      limit 10
    ) x;
  end if;

  return result;
end $$;

-- ---------------------------------------------------------------------------
-- Attendance + annual validation reports: same word rule for the chosen field.
-- ---------------------------------------------------------------------------
create or replace function lirc_private.report_search(p jsonb, f jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(nullif(btrim(f->>'search'), ''), '') = '' then true
    else (
      select coalesce(bool_and(strpos(
          lower(case coalesce(f->>'search_by', 'full_name')
            when 'library_id' then p->>'library_id'
            when 'first_name' then p->>'first_name'
            when 'surname' then p->>'surname'
            when 'middle_initial' then p->>'middle_initial'
            when 'suffix' then p->>'suffix'
            else concat_ws(' ', p->>'first_name', p->>'middle_initial',
                           p->>'surname', p->>'suffix')
          end),
          lower(word)) > 0), true)
      from unnest(regexp_split_to_array(left(btrim(f->>'search'), 120), '\s+')) as word
      where word <> ''
    )
  end;
$$;

-- ---------------------------------------------------------------------------
-- Inventory review list: every word must appear in the accession number or
-- the book title (any order).
-- ---------------------------------------------------------------------------
create or replace function public.lirc_inventory_unscanned(
  p_session_id bigint,
  p_search text default '',
  p_limit integer default 100,
  p_offset integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text;
  v_limit integer;
  v_offset integer;
  v_total bigint;
  v_rows jsonb;
begin
  if lirc_private.library_operator_id() is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.inventory_sessions s where s.id = p_session_id) then
    raise exception 'Inventory not found.';
  end if;
  v_search := btrim(coalesce(p_search, ''));
  if char_length(v_search) > 120 then
    v_search := left(v_search, 120);
  end if;
  v_limit := least(greatest(coalesce(p_limit, 100), 1), 200);
  v_offset := greatest(coalesce(p_offset, 0), 0);

  select count(*) into v_total
  from public.book_accession_numbers a
  join public.books b on b.id = a.book_id
  where not exists (
      select 1 from public.inventory_entries e
      where e.session_id = p_session_id and e.accession_id = a.id and e.outcome = 'Found')
    and (v_search = ''
      or not exists (
        select 1 from unnest(regexp_split_to_array(lower(v_search), '\s+')) as w
        where w <> ''
          and a.accession_number not ilike '%' || w || '%'
          and b.book_name not ilike '%' || w || '%'));

  select coalesce(jsonb_agg(x.row order by x.ord), '[]'::jsonb)
    into v_rows
  from (
    select jsonb_build_object(
        'accession_id', a.id,
        'accession_number', a.accession_number,
        'book_name', b.book_name,
        'borrowed', (l.id is not null),
        'missing', (e.id is not null),
        'condition', a.condition) as row,
      row_number() over (order by lower(a.accession_number), a.id) as ord
    from public.book_accession_numbers a
    join public.books b on b.id = a.book_id
    left join public.book_loans l
      on l.accession_id = a.id and l.returned_at is null
    left join public.inventory_entries e
      on e.session_id = p_session_id and e.accession_id = a.id and e.outcome = 'Missing'
    where not exists (
        select 1 from public.inventory_entries f
        where f.session_id = p_session_id and f.accession_id = a.id and f.outcome = 'Found')
      and (v_search = ''
        or not exists (
          select 1 from unnest(regexp_split_to_array(lower(v_search), '\s+')) as w
          where w <> ''
            and a.accession_number not ilike '%' || w || '%'
            and b.book_name not ilike '%' || w || '%'))
    order by lower(a.accession_number), a.id
    limit v_limit offset v_offset
  ) x;

  return jsonb_build_object(
    'rows', v_rows,
    'total', v_total,
    'has_next', (v_offset + v_limit) < v_total);
end $$;

revoke all on function
  public.lirc_member_lookup(text),
  public.lirc_inventory_unscanned(bigint, text, integer, integer)
  from public, anon;
grant execute on function
  public.lirc_member_lookup(text),
  public.lirc_inventory_unscanned(bigint, text, integer, integer)
  to authenticated;

notify pgrst, 'reload schema';
commit;
