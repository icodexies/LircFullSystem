-- Complete the missing catalog storage/search setup in the verified live project.
-- Existing attendance, annual enrollment, profiles and catalog records remain intact.
-- No catalog records or existing images are deleted.
begin;

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
do $$
declare extension_schema text;
begin
  select n.nspname into extension_schema from pg_catalog.pg_extension e
    join pg_catalog.pg_namespace n on n.oid = e.extnamespace where e.extname = 'pg_trgm';
  execute format('create index if not exists idx_opac_accession_trgm on public.book_accession_numbers using gin (accession_number %I.gin_trgm_ops)', extension_schema);
end;
$$;

-- Covers are public catalog images. Only editors can create new image objects.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-covers', 'book-covers', true, 524288, array['image/webp'])
;

create policy "LIRC covers insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'book-covers' and (select lirc_private.can_edit_catalog())
    and name ~ '^[1-9][0-9]*/[0-9a-f-]{36}\.webp$'
    and exists (select 1 from public.books b where b.id::text = split_part(name, '/', 1)));
-- Restrictive policies AND with older broad storage policies. Existing buckets
-- are unaffected; book-covers clients may insert only, never overwrite/delete.
create policy "LIRC covers write boundary" on storage.objects as restrictive
  for all to authenticated
  using (bucket_id <> 'book-covers')
  with check (bucket_id <> 'book-covers' or (
    (select lirc_private.can_edit_catalog())
    and name ~ '^[1-9][0-9]*/[0-9a-f-]{36}\.webp$'
    and exists (select 1 from public.books b where b.id::text = split_part(name, '/', 1))
  ));
create policy "LIRC covers anonymous boundary" on storage.objects as restrictive
  for all to anon using (bucket_id <> 'book-covers')
  with check (bucket_id <> 'book-covers');

do $catalog_indexes$
declare extension_schema text; target_column text;
begin
 select n.nspname into extension_schema from pg_catalog.pg_extension e
 join pg_catalog.pg_namespace n on n.oid=e.extnamespace where e.extname='pg_trgm';
 foreach target_column in array array['book_name','author','isbn','call_number'] loop
  execute format('create index if not exists %I on public.books using gin (%I %I.gin_trgm_ops)',
   'idx_opac_'||target_column||'_trgm',target_column,extension_schema);
 end loop;
end;
$catalog_indexes$;

notify pgrst, 'reload schema';
commit;


