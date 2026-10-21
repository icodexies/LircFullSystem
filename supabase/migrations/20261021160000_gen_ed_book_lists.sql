-- ============================================================================
-- Gen Ed book lists - first pass from the library's Gen Ed collection list
-- (Gen-Ed Updated@.pdf, 21 Oct 2026).
--
-- Each Gen Ed group receives the books that were confidently matched to a
-- catalog record (exact/close title, with year/copies/author used to pick
-- between duplicate records). Mismatches and titles missing from the catalog
-- are left for a manual pass in the Path Finder (Add a book / Remove).
--
-- Also changes the representative Gen Ed code to the code used by the most
-- program entries (e.g. RPH301 rather than a two-program variant).
-- ============================================================================-- Gen Ed book lists from the library's Gen Ed collection (PDF, 21 Oct 2026).
-- Only books matched confidently to catalog records are linked; the rest are
-- left for a manual pass. The import is idempotent.
begin;

-- Representative code = the code used by the most program entries.
create or replace function lirc_private.gen_ed_primary_code(p_gen_ed_id bigint)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select code
  from (
    select upper(btrim(s.course_code)) as code, count(e.id) as uses
    from public.curriculum_subjects s
    left join public.curriculum_entries e on e.subject_id = s.id
    where s.gen_ed_subject_id = p_gen_ed_id
    group by 1
  ) q
  order by uses desc, code
  limit 1;
$$;
revoke all on function lirc_private.gen_ed_primary_code(bigint)
  from public, anon, authenticated;

insert into public.subject_recommendations
  (course_code, gen_ed_subject_id, book_id, source, note, status,
   recommended_by, reviewed_by, reviewed_at)
select lirc_private.gen_ed_primary_code(g.id), g.id, v.book_id,
       'librarian', null, 'approved', a.id, a.id, now()
from (values
  ('understanding-the-self', 520),  ('understanding-the-self', 521),  ('understanding-the-self', 526),  ('understanding-the-self', 527),  ('readings-philippine-history', 2702),  ('readings-philippine-history', 2703),  ('readings-philippine-history', 2705),  ('readings-philippine-history', 2708),  ('readings-philippine-history', 2709),  ('readings-philippine-history', 2711),  ('readings-philippine-history', 2714),  ('readings-philippine-history', 2716),  ('readings-philippine-history', 2718),  ('contemporary-world', 840),  ('contemporary-world', 842),  ('contemporary-world', 844),  ('contemporary-world', 845),  ('mathematics-modern-world', 1664),  ('mathematics-modern-world', 1665),  ('mathematics-modern-world', 1666),  ('mathematics-modern-world', 1432),  ('mathematics-modern-world', 1662),  ('interactive-english', 2563),  ('english-specific-purposes', 1267),  ('english-specific-purposes', 1183),  ('purposive-communication', 1320),  ('purposive-communication', 1322),  ('purposive-communication', 1323),  ('purposive-communication', 1324),  ('purposive-communication', 1325),  ('purposive-communication', 1326),  ('purposive-communication', 1328),  ('art-appreciation', 2438),  ('art-appreciation', 2439),  ('art-appreciation', 2440),  ('art-appreciation', 2441),  ('art-appreciation', 2442),  ('art-appreciation', 2443),  ('art-appreciation', 806),  ('science-technology-society', 851),  ('science-technology-society', 852),  ('science-technology-society', 855),  ('science-technology-society', 856),  ('science-technology-society', 857),  ('ethics', 581),  ('ethics', 582),  ('ethics', 583),  ('ethics', 557),  ('ethics', 558),  ('ethics', 560),  ('ethics', 564),  ('ethics', 565),  ('ethics', 567),  ('ethics', 570),  ('entrepreneurial-mind', 930),  ('entrepreneurial-mind', 2246),  ('entrepreneurial-mind', 2311),  ('entrepreneurial-mind', 2314),  ('entrepreneurial-mind', 2252),  ('global-citizenship', 2658),  ('global-citizenship', 691),  ('rizal', 2693),  ('rizal', 2696),  ('rizal', 2698),  ('rizal', 2678),  ('rizal', 2679),  ('rizal', 2680),  ('rizal', 2681),  ('rizal', 2682),  ('rizal', 2683),  ('rizal', 2684),  ('rizal', 2686),  ('rizal', 2687),  ('living-it-era', 122),  ('living-it-era', 367),  ('living-it-era', 624),  ('living-it-era', 756),  ('living-it-era', 86),  ('living-it-era', 858),  ('pe-1', 1767),  ('pe-2', 1765),  ('pe-3', 1773),  ('pe-4', 2458),  ('pe-4', 2461),  ('nstp-1', 865),  ('nstp-1', 874),  ('nstp-1', 1042),  ('nstp-1', 1044),  ('nstp-1', 1045),  ('nstp-1', 1046),  ('nstp-1', 1783),  ('nstp-2', 867),  ('nstp-2', 872),  ('nstp-2', 1042),  ('nstp-2', 1044),  ('nstp-2', 1045),  ('nstp-2', 1046),  ('nstp-2', 1783),  ('gender-society', 763),  ('gender-society', 628),  ('gender-society', 630),  ('gender-society', 631)
) as v(group_key, book_id)
join public.gen_ed_subjects g on g.key = v.group_key
cross join (select id from public."usersData" where library_id = 'ADM-0001') a
where not exists (
  select 1 from public.subject_recommendations r
  where r.book_id = v.book_id
    and (
      r.gen_ed_subject_id = g.id
      or r.course_code = any(lirc_private.gen_ed_codes(g.id))))
on conflict (course_code, book_id) where status in ('pending', 'approved') do nothing;

notify pgrst, 'reload schema';
commit;

