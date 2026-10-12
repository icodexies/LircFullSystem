-- Edit a book's copies from the Add Book window: when staff pick an existing
-- record, its accession numbers load into the form so they can edit, delete
-- or keep them, and add more. One transaction applies everything.
-- A copy that has loan records cannot be deleted (loan history must stay true).
begin;

-- Field validation for one accession row, shared by every copy-saving path.
create or replace function lirc_private.clean_accession_item(p_item jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_number text;
  v_shelf text;
  v_condition text;
begin
  if p_item is null or jsonb_typeof(p_item) <> 'object' then
    raise exception 'Invalid accession row.';
  end if;
  v_number := btrim(coalesce(p_item->>'accession_number', ''));
  if v_number = '' then
    raise exception 'Every accession row needs an accession number.';
  end if;
  if length(v_number) > 120 then
    raise exception 'Accession numbers must be 120 characters or fewer.';
  end if;
  v_shelf := btrim(coalesce(p_item->>'shelf_id', ''));
  if v_shelf <> '' and (
    v_shelf !~ '^[1-9][0-9]*$'
    or not exists (select 1 from public.shelves s where s.id = v_shelf::bigint)
  ) then
    raise exception 'Choose a valid shelf for every copy.';
  end if;
  v_condition := btrim(coalesce(p_item->>'condition', ''));
  if v_condition <> '' and v_condition not in ('Good', 'Fair', 'Poor', 'Damaged') then
    raise exception 'Choose a valid condition for every copy.';
  end if;
  return jsonb_build_object(
    'accession_number', v_number,
    'shelf_id', case when v_shelf = '' then null else v_shelf::bigint end,
    'condition', nullif(v_condition, ''));
end $$;
revoke all on function lirc_private.clean_accession_item(jsonb) from public, anon, authenticated;

-- clean_accessions now reuses the item helper (same behavior as before).
create or replace function lirc_private.clean_accessions(p_accessions jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb := '[]'::jsonb;
  item jsonb;
  v_clean jsonb;
  v_seen text[] := '{}'::text[];
  v_dupe text;
begin
  if p_accessions is null
     or jsonb_typeof(p_accessions) <> 'array'
     or jsonb_array_length(p_accessions) = 0 then
    raise exception 'Add at least one accession number.';
  end if;
  if jsonb_array_length(p_accessions) > 200 then
    raise exception 'At most 200 accession numbers can be added at once.';
  end if;
  for item in select value from jsonb_array_elements(p_accessions) loop
    v_clean := lirc_private.clean_accession_item(item);
    if lower(v_clean->>'accession_number') = any (v_seen) then
      raise exception 'Accession number % appears twice in the form.', v_clean->>'accession_number';
    end if;
    v_seen := v_seen || lower(v_clean->>'accession_number');
    result := result || jsonb_build_array(v_clean);
  end loop;
  select string_agg(x.n, ', ') into v_dupe
  from (
    select distinct a.accession_number as n
    from public.book_accession_numbers a
    where lower(a.accession_number) = any (v_seen)
    limit 5
  ) x;
  if v_dupe is not null then
    raise exception 'These accession numbers already exist in the catalog: %.', v_dupe;
  end if;
  return result;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: apply copy changes to one book (updates + deletions + additions)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_save_book_copies(
  p_book_id bigint,
  p_updates jsonb default '[]'::jsonb,
  p_new jsonb default '[]'::jsonb,
  p_delete_ids bigint[] default '{}'::bigint[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing jsonb := '[]'::jsonb;
  v_new_clean jsonb := '[]'::jsonb;
  v_update_map jsonb := '{}'::jsonb;
  v_keep_ids bigint[] := '{}';
  v_seen text[] := '{}';
  v_deleted int := 0;
  v_updated int := 0;
  v_added int := 0;
  v_id bigint;
  v_number text;
  v_clean jsonb;
  v_dupe text;
  item jsonb;
  rec record;
begin
  if not lirc_private.can_edit_catalog() then
    raise exception 'Librarian or admin access required.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.books b where b.id = p_book_id) then
    raise exception 'Book record not found.';
  end if;
  if p_updates is null or jsonb_typeof(p_updates) <> 'array'
     or p_new is null or jsonb_typeof(p_new) <> 'array' then
    raise exception 'Invalid changes.';
  end if;
  if jsonb_array_length(p_updates) > 200 or jsonb_array_length(p_new) > 200 then
    raise exception 'Too many changes at once.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id, 'accession_number', a.accession_number) order by a.id), '[]'::jsonb)
    into v_existing
  from public.book_accession_numbers a
  where a.book_id = p_book_id;

  -- Deletions must belong to this book.
  if exists (
    select 1 from unnest(p_delete_ids) d
    where not exists (
      select 1 from public.book_accession_numbers a
      where a.id = d and a.book_id = p_book_id
    )
  ) then
    raise exception 'A copy to remove was not found on this book.';
  end if;

  -- Normalize the updates; each id must be a copy of this book.
  for item in select value from jsonb_array_elements(p_updates) loop
    begin
      v_id := (item->>'id')::bigint;
    exception when others then
      raise exception 'Invalid change row.';
    end;
    if v_id = any (p_delete_ids) then
      raise exception 'A copy cannot be changed and removed at the same time.';
    end if;
    if not exists (
      select 1 from public.book_accession_numbers a
      where a.id = v_id and a.book_id = p_book_id
    ) then
      raise exception 'A copy to change was not found on this book.';
    end if;
    v_clean := lirc_private.clean_accession_item(item);
    v_update_map := jsonb_set(v_update_map, array[v_id::text], v_clean, true);
  end loop;

  -- New copies (field validation only; conflicts are checked below).
  select coalesce(jsonb_agg(lirc_private.clean_accession_item(x) order by ord), '[]'::jsonb)
    into v_new_clean
  from jsonb_array_elements(p_new) with ordinality as t(x, ord);

  -- Final number list: remaining copies (updated where sent) + new copies.
  for rec in
    select (e->>'id')::bigint as id, e->>'accession_number' as number
    from jsonb_array_elements(v_existing) e
  loop
    if rec.id = any (p_delete_ids) then
      continue;
    end if;
    v_keep_ids := v_keep_ids || rec.id;
    v_number := coalesce(
      (v_update_map -> rec.id::text) ->> 'accession_number',
      rec.number);
    if lower(v_number) = any (v_seen) then
      raise exception 'Accession number % appears twice.', v_number;
    end if;
    v_seen := v_seen || lower(v_number);
  end loop;
  for item in select value from jsonb_array_elements(v_new_clean) loop
    v_number := item->>'accession_number';
    if lower(v_number) = any (v_seen) then
      raise exception 'Accession number % appears twice.', v_number;
    end if;
    v_seen := v_seen || lower(v_number);
  end loop;

  -- Any of those numbers used by a different copy elsewhere?
  select a.accession_number into v_dupe
  from public.book_accession_numbers a
  where lower(a.accession_number) = any (v_seen)
    and a.id <> all (v_keep_ids)
  limit 1;
  if v_dupe is not null then
    raise exception 'Accession number % already belongs to another copy.', v_dupe;
  end if;

  -- Apply: remove first (so their numbers can be reused), then update, then add.
  if array_length(p_delete_ids, 1) is not null then
    begin
      delete from public.book_accession_numbers
       where id = any (p_delete_ids) and book_id = p_book_id;
      get diagnostics v_deleted = row_count;
    exception when foreign_key_violation then
      raise exception 'A copy that has loan records cannot be removed. Its borrowing history must stay.';
    end;
  end if;

  for rec in select key::bigint as id, value as clean from jsonb_each(v_update_map) loop
    update public.book_accession_numbers a
       set accession_number = rec.clean->>'accession_number',
           shelf_id = (rec.clean->>'shelf_id')::bigint,
           condition = rec.clean->>'condition'
     where a.id = rec.id and a.book_id = p_book_id;
    v_updated := v_updated + 1;
  end loop;

  for item in select value from jsonb_array_elements(v_new_clean) loop
    insert into public.book_accession_numbers
      (book_id, accession_number, status, shelf_id, condition)
    values
      (p_book_id, item->>'accession_number', 'Available',
       (item->>'shelf_id')::bigint, item->>'condition');
    v_added := v_added + 1;
  end loop;

  return jsonb_build_object('updated', v_updated, 'deleted', v_deleted, 'added', v_added);
end $$;

revoke all on function public.lirc_save_book_copies(bigint,jsonb,jsonb,bigint[]) from public, anon;
grant execute on function public.lirc_save_book_copies(bigint,jsonb,jsonb,bigint[]) to authenticated;

notify pgrst, 'reload schema';
commit;
