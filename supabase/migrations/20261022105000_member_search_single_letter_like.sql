-- Same semantics as 20261022103000, faster single-letter branch.
-- The token is guaranteed to be one [a-z0-9] character here, so LIKE cannot
-- see a user % or _; longer words still use literal position().
begin;

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

  v_normal := lower(regexp_replace(v_search, '[.,]', ' ', 'g'));
  select coalesce(array_agg(w), '{}') into v_words
  from unnest(regexp_split_to_array(v_normal, '\s+')) as w
  where w <> '';
  if cardinality(v_words) = 0 then
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
         where not (
           case
             when length(w) = 1 and w ~ '^[a-z0-9]$'
               then u.search_name like w || '%' or u.search_name like '% ' || w || '%'
             else position(w in u.search_name) > 0
           end
         )
       )
    order by u.surname, u.id
    limit 10
  ) x;

  if result->'members' = '[]'::jsonb and v_normal !~ '[%_]' then
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

commit;
