-- ============================================================================
-- DCI Path Finder: expand the catalog coverage window from 5 to 10 years.
--
-- Existing DCI recommendations cover books published 2021-2024. This adds
-- relevant catalog books published 2016-2020 for every course code in the
-- BSCS and BSIT curricula (74 codes, 303 subject/book links).
--
-- The rows are added as approved librarian recommendations, keyed by course
-- code. They are intentionally direct course recommendations (not Gen Ed
-- group links) so the change stays scoped to the DCI curriculum. The script
-- is idempotent and refuses to finish if any DCI code still has no 2016-2020
-- approved book.
-- ============================================================================
begin;

do $$
declare
  v_admin bigint;
  v_added integer;
  v_missing integer;
  v_total integer;
begin
  select id into v_admin
  from public."usersData"
  where id = 1 and lower(btrim(role::text)) = 'admin';

  if v_admin is null then
    raise exception 'The DCI recommendation owner (admin id 1) was not found.';
  end if;

  insert into public.subject_recommendations
    (course_code, book_id, source, note, status,
     recommended_by, reviewed_by, reviewed_at)
  select v.course_code, v.book_id, 'librarian',
         'DCI 10-year catalog coverage (2016-2024)', 'approved',
         v_admin, v_admin, now()
  from (values
  ('ACCTG201', 1932),
  ('ACCTG201', 1805),
  ('ACCTG201', 1849),
  ('ACCTG201', 2193),
  ('ALG101', 1466),
  ('ALG101', 1482),
  ('ALG101', 1483),
  ('ALG101', 1676),
  ('CALC102', 1690),
  ('CALC102', 1686),
  ('CALC102', 1496),
  ('CALC102', 1504),
  ('CAP302', 18),
  ('CAP302', 19),
  ('CAP302', 1789),
  ('CAP401', 18),
  ('CAP401', 19),
  ('CAP401', 1789),
  ('CEEL301', 330),
  ('CEEL301', 337),
  ('CEEL301', 339),
  ('CEEL302', 302),
  ('CEEL302', 414),
  ('CEEL302', 303),
  ('CEEL302', 339),
  ('CEEL302', 413),
  ('CEEL311', 61),
  ('CEEL311', 122),
  ('CEEL311', 300),
  ('CEEL311', 305),
  ('CEEL312', 125),
  ('CEEL312', 306),
  ('CEEL312', 227),
  ('CS101', 48),
  ('CS101', 42),
  ('CS101', 174),
  ('CS101', 140),
  ('CS102', 175),
  ('CS102', 389),
  ('CS102', 178),
  ('CS102', 151),
  ('CS201', 272),
  ('CS201', 271),
  ('CS201', 270),
  ('CS201', 267),
  ('CS201', 288),
  ('CS202', 409),
  ('CS202', 141),
  ('CS202', 261),
  ('CS202', 258),
  ('CS211', 358),
  ('CS211', 344),
  ('CS211', 176),
  ('CS211', 357),
  ('CS211', 420),
  ('CS212', 1452),
  ('CS212', 249),
  ('CS212', 324),
  ('CS212', 66),
  ('CS212', 322),
  ('CS221', 159),
  ('CS221', 57),
  ('CS221', 1448),
  ('CS222', 57),
  ('CS222', 58),
  ('CS222', 1448),
  ('CS222', 1444),
  ('CS231', 151),
  ('CS231', 175),
  ('CS231', 389),
  ('CS231', 178),
  ('CS231', 393),
  ('CS232', 126),
  ('CS232', 142),
  ('CS232', 139),
  ('CS232', 137),
  ('CS242', 230),
  ('CS242', 228),
  ('CS242', 77),
  ('CS242', 78),
  ('CS252', 358),
  ('CS252', 344),
  ('CS252', 176),
  ('CS252', 357),
  ('CS252', 420),
  ('CS262', 322),
  ('CS262', 321),
  ('CS262', 249),
  ('CS262', 324),
  ('CS262', 253),
  ('CS301', 77),
  ('CS301', 78),
  ('CS301', 405),
  ('CS301', 2390),
  ('CS302', 18),
  ('CS302', 19),
  ('CS302', 1789),
  ('CS311', 132),
  ('CS311', 137),
  ('CS311', 138),
  ('CS311', 2296),
  ('CS321', 394),
  ('CS321', 151),
  ('CS321', 393),
  ('CS333', 125),
  ('CS333', 61),
  ('CS333', 122),
  ('CS333', 321),
  ('CS333', 300),
  ('CS401', 18),
  ('CS401', 19),
  ('CS401', 1789),
  ('DIS201', 57),
  ('DIS201', 58),
  ('DIS201', 1487),
  ('DIS201', 1448),
  ('ENV201', 1596),
  ('ENV201', 650),
  ('ENV201', 1627),
  ('ETHICS301', 567),
  ('ETHICS301', 562),
  ('ETHICS301', 564),
  ('ETHICS301', 570),
  ('ETHICS301', 557),
  ('ETHICS301', 297),
  ('ETHICS301', 413),
  ('ETHICS302', 567),
  ('ETHICS302', 562),
  ('ETHICS302', 564),
  ('ETHICS302', 570),
  ('ETHICS302', 557),
  ('ETHICS302', 297),
  ('ETHICS302', 413),
  ('GCE302', 881),
  ('GCE302', 880),
  ('GCE302', 952),
  ('GCE302', 848),
  ('GCE401', 881),
  ('GCE401', 880),
  ('GCE401', 952),
  ('GCE401', 848),
  ('HCI301', 64),
  ('HCI302', 64),
  ('IAS202', 302),
  ('IAS202', 414),
  ('IAS202', 303),
  ('IAS202', 305),
  ('IAS202', 306),
  ('IAS202', 298),
  ('IAS202', 300),
  ('IAS202', 299),
  ('IAS301', 302),
  ('IAS301', 414),
  ('IAS301', 303),
  ('IAS301', 305),
  ('IAS301', 306),
  ('IAS301', 298),
  ('IAS301', 300),
  ('IAS301', 299),
  ('IE101', 1247),
  ('IE101', 1268),
  ('IE101', 1257),
  ('IE101', 2563),
  ('IT101', 48),
  ('IT101', 42),
  ('IT101', 43),
  ('IT101', 624),
  ('IT101', 174),
  ('IT102', 268),
  ('IT102', 269),
  ('IT102', 66),
  ('IT102', 67),
  ('IT102', 271),
  ('IT201', 409),
  ('IT201', 141),
  ('IT201', 261),
  ('IT201', 258),
  ('IT202', 126),
  ('IT202', 142),
  ('IT202', 139),
  ('IT202', 137),
  ('IT202', 2296),
  ('IT211', 272),
  ('IT211', 271),
  ('IT211', 270),
  ('IT211', 267),
  ('IT211', 288),
  ('IT221', 358),
  ('IT221', 344),
  ('IT221', 176),
  ('IT221', 357),
  ('IT221', 420),
  ('IT231', 230),
  ('IT231', 228),
  ('IT301', 132),
  ('IT301', 137),
  ('IT301', 138),
  ('IT301', 2296),
  ('LDS202', 2390),
  ('LDS202', 405),
  ('LDS202', 77),
  ('MATH101', 1527),
  ('MATH101', 1534),
  ('MATH101', 1541),
  ('MATH101', 1516),
  ('MATH101', 1536),
  ('NC102', 101),
  ('NC102', 110),
  ('NC102', 93),
  ('NC102', 377),
  ('NC102', 94),
  ('NET102', 101),
  ('NET102', 110),
  ('NET102', 93),
  ('NET102', 377),
  ('NET201', 95),
  ('NET201', 96),
  ('NET201', 93),
  ('NET201', 90),
  ('NET202', 95),
  ('NET202', 96),
  ('NET202', 110),
  ('NET202', 90),
  ('NET301', 96),
  ('NET301', 90),
  ('NET301', 110),
  ('NET301', 94),
  ('NSTP101', 871),
  ('NSTP101', 874),
  ('NSTP101', 865),
  ('NSTP102', 871),
  ('NSTP102', 874),
  ('NSTP102', 865),
  ('NUM102', 1487),
  ('NUM102', 1489),
  ('NUM102', 1485),
  ('NUM102', 1488),
  ('PATHFIT1', 1776),
  ('PATHFIT1', 1780),
  ('PATHFIT1', 1778),
  ('PATHFIT2', 1768),
  ('PATHFIT2', 2449),
  ('PATHFIT2', 1776),
  ('PATHFIT3', 1770),
  ('PATHFIT3', 2449),
  ('PATHFIT4', 2458),
  ('PATHFIT4', 1770),
  ('PCOM102', 1347),
  ('PCOM102', 1327),
  ('PCOM102', 1319),
  ('PRAC402', 18),
  ('PRAC402', 19),
  ('PRAC402', 2296),
  ('PRAC402', 2297),
  ('RIZAL201', 2698),
  ('RIZAL201', 2696),
  ('RIZAL201', 2693),
  ('RIZAL301', 2698),
  ('RIZAL301', 2696),
  ('RIZAL301', 2693),
  ('RPH201', 2711),
  ('RPH201', 2715),
  ('RPH201', 2716),
  ('RPH201', 2718),
  ('SAM202', 227),
  ('SAM202', 230),
  ('SAM202', 269),
  ('SAM202', 271),
  ('SEC101', 302),
  ('SEC101', 414),
  ('SEC101', 303),
  ('SEC101', 305),
  ('SEC101', 306),
  ('SEC101', 298),
  ('SEC101', 300),
  ('SEC101', 299),
  ('SEC101', 413),
  ('SIA301', 77),
  ('SIA301', 78),
  ('SIA301', 66),
  ('SIA301', 67),
  ('SIA301', 2296),
  ('SQA301', 126),
  ('SQA301', 139),
  ('SQA301', 137),
  ('SQA301', 138),
  ('SQA302', 126),
  ('SQA302', 139),
  ('SQA302', 137),
  ('SQA302', 138),
  ('TECH301', 652),
  ('TECH301', 932),
  ('TECH301', 2074),
  ('TECH301', 2313),
  ('TECH301', 2311),
  ('TECH302', 652),
  ('TECH302', 932),
  ('TECH302', 2074),
  ('TECH302', 2313),
  ('TECH302', 2311),
  ('US101', 524),
  ('US101', 526),
  ('US101', 527)
  ) as v(course_code, book_id)
  where exists (
    select 1 from public.curriculum_subjects s
    where upper(btrim(s.course_code)) = v.course_code)
    and exists (
      select 1 from public.books b
      where b.id = v.book_id
        and nullif(regexp_replace(b.publish_year::text, '[^0-9]', '', 'g'), '')::int
            between 2016 and 2020)
    and not exists (
      select 1 from public.subject_recommendations r
      where upper(btrim(r.course_code)) = v.course_code
        and r.book_id = v.book_id
        and r.status in ('pending', 'approved'))
  on conflict (course_code, book_id)
    where status in ('pending', 'approved') do nothing;

  get diagnostics v_added = row_count;

  with dci_codes as (
    select distinct upper(btrim(s.course_code)) as course_code
    from public.curriculum_entries e
    join public.curriculum_programs cp on cp.id = e.curriculum_program_id
    join public.curriculum_subjects s on s.id = e.subject_id
    where cp.code in ('BSCS', 'BSIT')
  )
  select count(*) into v_missing
  from dci_codes d
  where not exists (
    select 1
    from public.subject_recommendations r
    join public.books b on b.id = r.book_id
    where upper(btrim(r.course_code)) = d.course_code
      and r.status = 'approved'
      and nullif(regexp_replace(b.publish_year::text, '[^0-9]', '', 'g'), '')::int
          between 2016 and 2020);

  if v_missing > 0 then
    raise exception 'The DCI 10-year expansion left % course code(s) without a 2016-2020 book.', v_missing;
  end if;

  select count(*) into v_total
  from public.subject_recommendations
  where note = 'DCI 10-year catalog coverage (2016-2024)';

  raise notice 'DCI 10-year expansion: % rows inserted; % rows now carry the 10-year note.', v_added, v_total;
end $$;

notify pgrst, 'reload schema';
commit;
