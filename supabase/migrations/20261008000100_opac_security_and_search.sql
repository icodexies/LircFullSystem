-- Apply after the four catalog tables from the supplied schema exist.
-- Preserves catalog records. Replaces catalog policies and client grants.
-- usersData remains trusted: browser clients may read only their own profile
-- and cannot insert, change or delete profile/role/registration records.
begin;

do $$
declare
  target_table text;
begin
  foreach target_table in array array['books', 'book_formats', 'shelves', 'book_accession_numbers', 'usersData'] loop
    if pg_catalog.to_regclass(format('public.%I', target_table)) is null then
      raise exception 'Missing table public.%. Apply the catalog/user schema before this OPAC migration.', target_table;
    end if;
  end loop;
end;
$$;

create schema if not exists lirc_private;
revoke all on schema lirc_private from public, anon;
grant usage on schema lirc_private to authenticated, service_role;

create or replace function lirc_private.can_edit_catalog()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public."usersData" as u
    where u.user_id = (select auth.uid())
      and lower(trim(u.role::text)) in ('librarian', 'admin')
  );
$$;
revoke all on function lirc_private.can_edit_catalog() from public, anon;
grant execute on function lirc_private.can_edit_catalog() to authenticated, service_role;

create or replace function lirc_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := old.created_at;
  new.updated_at := pg_catalog.clock_timestamp();
  return new;
end;
$$;
revoke all on function lirc_private.set_updated_at() from public, anon, authenticated;

do $$
declare
  target_table text;
  column_list text;
  sequence_name text;
  old_policy record;
begin
  foreach target_table in array array['book_formats', 'shelves', 'books', 'book_accession_numbers'] loop
    execute format('alter table public.%I add column if not exists created_at timestamptz not null default now()', target_table);
    execute format('alter table public.%I add column if not exists updated_at timestamptz not null default now()', target_table);
    execute format('drop trigger if exists lirc_set_updated_at on public.%I', target_table);
    execute format('create trigger lirc_set_updated_at before update on public.%I for each row execute function lirc_private.set_updated_at()', target_table);
    execute format('alter table public.%I enable row level security', target_table);

    -- Permissive policies combine with OR, so old broad write policies must go.
    for old_policy in select policyname from pg_catalog.pg_policies where schemaname = 'public' and tablename = target_table loop
      execute format('drop policy %I on public.%I', old_policy.policyname, target_table);
    end loop;

    select string_agg(format('%I', a.attname), ', ') into column_list
      from pg_catalog.pg_attribute a
      where a.attrelid = pg_catalog.to_regclass(format('public.%I', target_table))
        and a.attnum > 0 and not a.attisdropped;
    -- Remove column grants too; revoking a table grant alone is insufficient.
    execute format('revoke all privileges on table public.%I from public, anon, authenticated', target_table);
    execute format('revoke all privileges (%s) on table public.%I from public, anon, authenticated', column_list, target_table);
    execute format('grant select on table public.%I to anon, authenticated', target_table);
    execute format('grant insert on table public.%I to authenticated', target_table);
    execute format('grant all privileges on table public.%I to service_role', target_table);

    execute format('create policy "Public catalog read" on public.%I for select to anon, authenticated using (true)', target_table);
    execute format('create policy "Librarian admin insert" on public.%I for insert to authenticated with check ((select lirc_private.can_edit_catalog()))', target_table);
    execute format('create policy "Librarian admin update" on public.%I for update to authenticated using ((select lirc_private.can_edit_catalog())) with check ((select lirc_private.can_edit_catalog()))', target_table);

    sequence_name := pg_catalog.pg_get_serial_sequence(format('public.%I', target_table), 'id');
    if sequence_name is not null then
      execute format('revoke all privileges on sequence %s from public, anon, authenticated', sequence_name);
      execute format('grant usage on sequence %s to authenticated', sequence_name);
      execute format('grant all privileges on sequence %s to service_role', sequence_name);
    end if;
  end loop;
end;
$$;

-- Editable columns only. Book IDs, created_at and updated_at cannot be set by
-- a browser UPDATE, even if someone bypasses the form and calls the API.
grant update (book_name, author, isbn, shelf_id, publish_year,
  book_image, call_number, edition, publisher, place_of_publication,
  barcode_tag_number, asset_number, book_format_id)
  on public.books to authenticated;
grant update (name) on public.book_formats, public.shelves to authenticated;
grant update (book_id, accession_number, status)
  on public.book_accession_numbers to authenticated;

-- Protect the source of privileges from client-side self-promotion.
do $$
declare column_list text;
begin
  select string_agg(format('%I', a.attname), ', ') into column_list
    from pg_catalog.pg_attribute a
    where a.attrelid = 'public."usersData"'::regclass
      and a.attnum > 0 and not a.attisdropped;
  revoke all privileges on public."usersData" from public, anon, authenticated;
  execute format('revoke all privileges (%s) on public."usersData" from public, anon, authenticated', column_list);
end;
$$;
grant select on public."usersData" to authenticated;
grant all privileges on public."usersData" to service_role;
alter table public."usersData" enable row level security;
drop policy if exists "LIRC own profile read" on public."usersData";
drop policy if exists "LIRC own profile boundary" on public."usersData";
create policy "LIRC own profile read" on public."usersData"
  for select to authenticated using (user_id = (select auth.uid()));
-- AND with existing policies, without deleting unrelated profile policies.
create policy "LIRC own profile boundary" on public."usersData"
  as restrictive for select to authenticated using (user_id = (select auth.uid()));
create index if not exists idx_lirc_users_auth_id on public."usersData" (user_id);

-- Stable, indexed ordering for bounded pages.
create index if not exists idx_opac_title_id on public.books (book_name, id);
create index if not exists idx_opac_created_id on public.books (created_at desc, id desc);
create index if not exists idx_opac_year_id on public.books (publish_year desc nulls last, id desc);
create index if not exists idx_opac_copy_order on public.book_accession_numbers (book_id, accession_number, id);
create index if not exists idx_books_shelf_id on public.books (shelf_id);
create index if not exists idx_books_book_format_id on public.books (book_format_id);

-- Trigram indexes support contains-text searches (especially 3+ characters).
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
do $$
declare
  extension_schema text;
  target_column text;
begin
  select n.nspname into extension_schema from pg_catalog.pg_extension e
    join pg_catalog.pg_namespace n on n.oid = e.extnamespace where e.extname = 'pg_trgm';
  foreach target_column in array array['book_name', 'author', 'isbn', 'call_number'] loop
    execute format('create index if not exists %I on public.books using gin (%I %I.gin_trgm_ops)',
      'idx_opac_' || target_column || '_trgm', target_column, extension_schema);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
commit;
