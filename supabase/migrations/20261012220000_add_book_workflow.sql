-- Adding books: create a book record with its physical copies in one step,
-- or add copies to an existing record. Copies gain a per-copy shelf and
-- condition (new form fields; older rows keep NULL).
begin;

alter table public.book_accession_numbers
  add column if not exists shelf_id bigint references public.shelves(id) on delete set null,
  add column if not exists condition text;
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.book_accession_numbers'::regclass
      and conname = 'book_accession_condition_check'
  ) then
    alter table public.book_accession_numbers
      add constraint book_accession_condition_check
      check (condition is null or condition in ('Good', 'Fair', 'Poor', 'Damaged'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Internal: validate + normalize the accession rows of the add-book form.
-- ---------------------------------------------------------------------------
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
  v_number text;
  v_shelf text;
  v_condition text;
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
    v_number := btrim(coalesce(item->>'accession_number', ''));
    if v_number = '' then
      raise exception 'Every accession row needs an accession number.';
    end if;
    if length(v_number) > 120 then
      raise exception 'Accession numbers must be 120 characters or fewer.';
    end if;
    if lower(v_number) = any(v_seen) then
      raise exception 'Accession number % appears twice in the form.', v_number;
    end if;
    v_seen := v_seen || lower(v_number);
    v_shelf := btrim(coalesce(item->>'shelf_id', ''));
    if v_shelf <> '' and (
      v_shelf !~ '^[1-9][0-9]*$'
      or not exists (select 1 from public.shelves s where s.id = v_shelf::bigint)
    ) then
      raise exception 'Choose a valid shelf for every copy.';
    end if;
    v_condition := btrim(coalesce(item->>'condition', ''));
    if v_condition <> '' and v_condition not in ('Good', 'Fair', 'Poor', 'Damaged') then
      raise exception 'Choose a valid condition for every copy.';
    end if;
    result := result || jsonb_build_array(jsonb_build_object(
      'accession_number', v_number,
      'shelf_id', case when v_shelf = '' then null else v_shelf::bigint end,
      'condition', nullif(v_condition, '')));
  end loop;

  -- Already in the catalog?
  select string_agg(x.n, ', ') into v_dupe
  from (
    select distinct a.accession_number as n
    from public.book_accession_numbers a
    where lower(a.accession_number) = any(v_seen)
    limit 5
  ) x;
  if v_dupe is not null then
    raise exception 'These accession numbers already exist in the catalog: %.', v_dupe;
  end if;

  return result;
end $$;
revoke all on function lirc_private.clean_accessions(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: create a book with its first accession copies (one transaction)
-- ---------------------------------------------------------------------------
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

  -- The catalog shows one section per book; use the first copy's shelf when
  -- one is chosen (each copy keeps its own shelf too).
  select (v_copies->0->>'shelf_id')::bigint into v_shelf;

  insert into public.books
    (book_name, author, isbn, publisher, edition, call_number, publish_year, shelf_id)
  values
    (v_name, v_author, v_isbn, v_publisher, v_edition, v_call,
     case when v_year = '' then null else v_year::integer end, v_shelf)
  returning id into v_book_id;

  insert into public.book_accession_numbers
    (book_id, accession_number, status, shelf_id, condition)
  select v_book_id,
         item->>'accession_number',
         'Available',
         (item->>'shelf_id')::bigint,
         item->>'condition'
  from jsonb_array_elements(v_copies) item;

  return jsonb_build_object(
    'book_id', v_book_id,
    'copies_added', jsonb_array_length(v_copies));
end $$;

-- ---------------------------------------------------------------------------
-- RPC: add accession copies to an existing book
-- ---------------------------------------------------------------------------
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
    (book_id, accession_number, status, shelf_id, condition)
  select p_book_id,
         item->>'accession_number',
         'Available',
         (item->>'shelf_id')::bigint,
         item->>'condition'
  from jsonb_array_elements(v_copies) item;

  return jsonb_build_object(
    'book_id', p_book_id,
    'copies_added', jsonb_array_length(v_copies));
end $$;

revoke all on function
  public.lirc_add_book(jsonb, jsonb),
  public.lirc_add_accessions(bigint, jsonb)
  from public, anon;
grant execute on function
  public.lirc_add_book(jsonb, jsonb),
  public.lirc_add_accessions(bigint, jsonb)
  to authenticated;

notify pgrst, 'reload schema';
commit;
