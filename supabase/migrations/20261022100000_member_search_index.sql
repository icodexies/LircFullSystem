-- ============================================================================
-- Member search: indexed name lookup
--
-- lirc_member_lookup scanned all ~10k users and called person_name() per row
-- (EXPLAIN: 105.6 ms). A stored search_name removes that per-row call (17.1 ms);
-- the pg_trgm index backs the typo fallback (75.8 ms -> 1.3 ms). Full RPC:
-- 93-174 ms before, 16-19 ms after. The multi-word fast path remains a cheap
-- sequential scan at this size; the index serves the fuzzy operator.
--
-- 15/18 sampled queries return identical results; three dotted-initial queries
-- are corrected (the old code returned 2 or fuzzy noise instead of 7). The
-- punctuation-as-separator follow-up is 20261022102000.
-- ============================================================================
begin;

alter table public."usersData"
  add column if not exists search_name text generated always as (
    lower(regexp_replace(
      coalesce(first_name, '') || ' ' || coalesce(middle_initial, '') || ' ' ||
      coalesce(surname, '') || ' ' || coalesce(suffix, ''),
      '[.,]', '', 'g'))
  ) stored;

comment on column public."usersData".search_name is
  'Lowercase name used by the member search; punctuation removed so "D." and "Villanueva," match cleanly.';

do $$
declare ext text;
begin
  select n.nspname into ext
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'pg_trgm';
  if ext is null then
    raise exception 'pg_trgm is required for the member search index.';
  end if;
  execute format(
    'create index if not exists usersdata_search_name_trgm on public."usersData" using gin (search_name %I.gin_trgm_ops)',
    ext);
end $$;

create or replace function public.lirc_member_lookup(p_search text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text;
  v_normal text;
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

  -- Punctuation (initials "D.", a typed comma) is ignored on both sides.
  v_normal := lower(regexp_replace(v_search, '[.,]', '', 'g'));
  select coalesce(array_agg(w), '{}') into v_words
  from unnest(regexp_split_to_array(v_normal, '\s+')) as w
  where w <> '';
  if cardinality(v_words) = 0 then
    raise exception 'Type a name or library card.';
  end if;

  -- 1) Exact card, or every word appears somewhere in the indexed name.
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
      lirc_private.person_name(u.first_name, u.middle_initial, u.surname, u.suffix) as full_name,
      u.library_id, u.role, u.surname,
      (select count(*) from public.book_loans l
        where l.user_profile_id = u.id and l.returned_at is null) as active_loans,
      (select count(*) from public.book_loans l
        where l.user_profile_id = u.id and l.returned_at is null and l.due_at < now()) as overdue_loans
    from public."usersData" u
    where lower(u.library_id) = lower(v_search)
       or not exists (
         select 1 from unnest(v_words) as w
         where u.search_name not like '%' || w || '%')
    order by u.surname, u.id
    limit 10
  ) x;

  -- 2) Nothing found: similar names (typos, spelling variants). The %> operator
  --    uses the same pg_trgm index and the standard 0.6 word-similarity limit.
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
        lirc_private.person_name(u.first_name, u.middle_initial, u.surname, u.suffix) as full_name,
        u.library_id, u.role, u.surname,
        extensions.word_similarity(v_normal, u.search_name) as similarity,
        (select count(*) from public.book_loans l
          where l.user_profile_id = u.id and l.returned_at is null) as active_loans,
        (select count(*) from public.book_loans l
          where l.user_profile_id = u.id and l.returned_at is null and l.due_at < now()) as overdue_loans
      from public."usersData" u
      where u.search_name OPERATOR(extensions.%>) v_normal
      order by similarity desc, u.surname, u.id
      limit 10
    ) x;
  end if;

  return result;
end $$;

notify pgrst, 'reload schema';
commit;
