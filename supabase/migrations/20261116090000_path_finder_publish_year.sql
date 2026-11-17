-- Add the publication year to Path Finder book data so the program Excel
-- report can show when each recommended title was published.
begin;

create or replace function lirc_private.path_finder_book_json(p_book_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'book_id', b.id,
    'book_name', b.book_name,
    'author', b.author,
    'isbn', b.isbn,
    'book_image', b.book_image,
    'call_number', b.call_number,
    'shelf', sh.name,
    'publish_year', b.publish_year,
    'copies', (select count(*) from public.book_accession_numbers a where a.book_id = b.id),
    'available', (select count(*) from public.book_accession_numbers a
                  where a.book_id = b.id
                    and lower(btrim(a.status)) = 'available'
                    and not exists (select 1 from public.book_loans l
                                    where l.accession_id = a.id and l.returned_at is null))
  )
  from public.books b
  left join public.shelves sh on sh.id = b.shelf_id
  where b.id = p_book_id;
$$;
revoke all on function lirc_private.path_finder_book_json(bigint)
  from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
