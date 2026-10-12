-- Remove the per-copy "condition" field: it was introduced for the Add Book
-- form, not part of the original schema, so the system drops it again.
-- The per-copy shelf stays (it is used by the form).
begin;

alter table public.book_accession_numbers drop constraint if exists book_accession_condition_check;
alter table public.book_accession_numbers drop column if exists condition;

-- Recreate the copy helpers without the condition field.
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
  return jsonb_build_object(
    'accession_number', v_number,
    'shelf_id', case when v_shelf = '' then null else v_shelf::bigint end);
end $$;
revoke all on function lirc_private.clean_accession_item(jsonb) from public, anon, authenticated;

create or replace function public.lirc_add_book(p_book jsonb, p_accessions jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_book_id bigint;
  v_copies jsonb;
  v_name text;
  v_author text;
  v_isbn text;
  v_publisher text;
  v_edition text;
  v_call text;
  v_year text;
  v_shelf bigint;
begin
  if not lirc_private.can_edit_catalog() then
    raise exception 'Librarian or admin access required.' using errcode = '42501';
  end if;
  if p_book is null or jsonb_typeof(p_book) <> 'object' then
    raise exception 'Invalid book details.';
  end if;

  v_name := btrim(coalesce(p_book->>'book_name', ''));
  v_author := nullif(btrim(coalesce(p_book->>'author', '')), '');
  v_isbn := nullif(btrim(coalesce(p_book->>'isbn', '')), '');
  v_publisher := nullif(btrim(coalesce(p_book->>'publisher', '')), '');
  v_edition := nullif(btrim(coalesce(p_book->>'edition', '')), '');
  v_call := nullif(btrim(coalesce(p_book->>'call_number', '')), '');
  v_year := btrim(coalesce(p_book->>'publish_year', ''));

  if v_name = '' then raise exception 'A book title is required.'; end if;
  if length(v_name) > 500 then raise exception 'Book title must be 500 characters or fewer.'; end if;
  if v_author is not null and length(v_author) > 1000 then raise exception 'Author must be 1000 characters or fewer.'; end if;
  if v_isbn is not null and length(v_isbn) > 100 then raise exception 'ISBN must be 100 characters or fewer.'; end if;
  if v_publisher is not null and length(v_publisher) > 500 then raise exception 'Publisher must be 500 characters or fewer.'; end if;
  if v_edition is not null and length(v_edition) > 200 then raise exception 'Edition must be 200 characters or fewer.'; end if;
  if v_call is not null and length(v_call) > 200 then raise exception 'Call number must be 200 characters or fewer.'; end if;
  if v_year <> '' and (v_year !~ '^\d{4}$' or v_year::integer < 1000 or v_year::integer > 2100) then
    raise exception 'Publication year must be between 1000 and 2100.';
  end if;

  v_copies := lirc_private.clean_accessions(p_accessions);

  select (v_copies->0->>'shelf_id')::bigint into v_shelf;

  insert into public.books
    (book_name, author, isbn, publisher, edition, call_number, publish_year, shelf_id)
  values
    (v_name, v_author, v_isbn, v_publisher, v_edition, v_call,
     case when v_year = '' then null else v_year::integer end, v_shelf)
  returning id into v_book_id;

  insert into public.book_accession_numbers
    (book_id, accession_number, status, shelf_id)
  select v_book_id,
         item->>'accession_number',
         'Available',
         (item->>'shelf_id')::bigint
  from jsonb_array_elements(v_copies) item;

  return jsonb_build_object(
    'book_id', v_book_id,
    'copies_added', jsonb_array_length(v_copies));
end $$;

create or replace function public.lirc_add_accessions(
  p_book_id bigint, p_accessions jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_copies jsonb;
begin
  if not lirc_private.can_edit_catalog() then
    raise exception 'Librarian or admin access required.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.books b where b.id = p_book_id) then
    raise exception 'Book record not found.';
  end if;
  v_copies := lirc_private.clean_accessions(p_accessions);

  insert into public.book_accession_numbers
    (book_id, accession_number, status, shelf_id)
  select p_book_id,
         item->>'accession_number',
         'Available',
         (item->>'shelf_id')::bigint
  from jsonb_array_elements(v_copies) item;

  return jsonb_build_object(
    'book_id', p_book_id,
    'copies_added', jsonb_array_length(v_copies));
end $$;

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

  if exists (
    select 1 from unnest(p_delete_ids) d
    where not exists (
      select 1 from public.book_accession_numbers a
      where a.id = d and a.book_id = p_book_id
    )
  ) then
    raise exception 'A copy to remove was not found on this book.';
  end if;

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

  select coalesce(jsonb_agg(lirc_private.clean_accession_item(x) order by ord), '[]'::jsonb)
    into v_new_clean
  from jsonb_array_elements(p_new) with ordinality as t(x, ord);

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

  select a.accession_number into v_dupe
  from public.book_accession_numbers a
  where lower(a.accession_number) = any (v_seen)
    and a.id <> all (v_keep_ids)
  limit 1;
  if v_dupe is not null then
    raise exception 'Accession number % already belongs to another copy.', v_dupe;
  end if;

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
           shelf_id = (rec.clean->>'shelf_id')::bigint
     where a.id = rec.id and a.book_id = p_book_id;
    v_updated := v_updated + 1;
  end loop;

  for item in select value from jsonb_array_elements(v_new_clean) loop
    insert into public.book_accession_numbers
      (book_id, accession_number, status, shelf_id)
    values
      (p_book_id, item->>'accession_number', 'Available',
       (item->>'shelf_id')::bigint);
    v_added := v_added + 1;
  end loop;

  return jsonb_build_object('updated', v_updated, 'deleted', v_deleted, 'added', v_added);
end $$;

revoke all on function
  public.lirc_add_book(jsonb, jsonb),
  public.lirc_add_accessions(bigint, jsonb),
  public.lirc_save_book_copies(bigint,jsonb,jsonb,bigint[])
  from public, anon;
grant execute on function
  public.lirc_add_book(jsonb, jsonb),
  public.lirc_add_accessions(bigint, jsonb),
  public.lirc_save_book_copies(bigint,jsonb,jsonb,bigint[])
  to authenticated;

notify pgrst, 'reload schema';
commit;
