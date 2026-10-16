-- Home collection adjustment: the first ordering (newest publications
-- first) surfaced the recently acquired local imprints, which the Open
-- Library covers API rarely has. Candidates now spread deterministically
-- across the whole catalog (stable hash order, uploaded covers first), and
-- the home page keeps the ones the API actually covers — so the carousel
-- shows real cover images.
-- ============================================================================
begin;

create or replace function public.lirc_home_collection(p_limit int default 12)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with base as (
    select b.id, b.book_name, b.author, b.isbn, b.book_image, b.call_number,
           b.publisher, b.publish_year, b.edition,
           coalesce(s.name, 'General Circulation Section') as section,
           (b.book_image is not null) as has_cover
    from public.books b
    left join public.shelves s on s.id = b.shelf_id
    left join public.book_formats f on f.id = b.book_format_id
    where lower(btrim(coalesce(f.name, 'books'))) = 'books'
    order by
      (b.book_image is not null) desc,
      md5(b.id::text)
    limit least(greatest(coalesce(p_limit, 12), 1), 24)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', b.id,
      'title', b.book_name,
      'author', b.author,
      'isbn', b.isbn,
      'cover', b.book_image,
      'section', b.section,
      'call_number', b.call_number,
      'publisher', b.publisher,
      'publish_year', b.publish_year,
      'edition', b.edition,
      'copies', (
        select count(*) from public.book_accession_numbers a
        where a.book_id = b.id),
      'available', (
        select count(*) from public.book_accession_numbers a
        where a.book_id = b.id
          and (a.status is null
               or lower(btrim(a.status)) in ('', 'available'))
          and not exists (
            select 1 from public.book_loans l
            where l.accession_id = a.id and l.returned_at is null)))
    ), '[]'::jsonb)
  from base b;
$$;

revoke all on function public.lirc_home_collection(int)
  from public, anon, authenticated;
grant execute on function public.lirc_home_collection(int)
  to anon, authenticated;

notify pgrst, 'reload schema';
commit;
