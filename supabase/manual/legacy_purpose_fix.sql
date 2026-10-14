-- ============================================================================
-- Precise purpose re-derive for the legacy import.
--
-- The import folded some legacy purposes into generic buckets; now that the
-- library's own option list is live (Borrow Books / Return Books / THESIS /
-- OJT / EXIT CLEARANCE), the imported visits get their true purpose back.
-- Match key: library card + exact time_in (the same conversion the import
-- used), and only where the current value is the imported placeholder.
-- ============================================================================
begin;
create temp table legacy_purpose_fix (
  user_id text, time_in text, purpose text) on commit drop;
insert into legacy_purpose_fix (user_id, time_in, purpose) values
('DAS-0001', '2026-07-15 11:06:53', 'Borrow Books'),
('DAS-0001', '2026-07-15 11:07:50', 'Return Books'),
('23-8042', '2026-07-15 11:20:28', 'THESIS'),
('23-8271', '2026-07-15 11:20:50', 'THESIS'),
('23-8924', '2026-07-15 11:21:03', 'THESIS'),
('23-8357', '2026-07-15 12:27:47', 'THESIS'),
('23-8590', '2026-07-15 12:28:04', 'THESIS'),
('23-9587', '2026-07-15 12:28:26', 'THESIS'),
('23-8047', '2026-07-15 12:28:47', 'THESIS'),
('23-8543', '2026-07-15 12:29:11', 'THESIS'),
('23-7972', '2026-07-15 12:29:33', 'THESIS'),
('DAS-0035', '2026-07-21 14:35:03', 'Borrow Books'),
('26-14137', '2026-07-23 11:22:32', 'Return Books'),
('DAS-0002', '2026-07-23 16:46:15', 'Borrow Books'),
('DAS-0016', '2026-07-23 17:43:34', 'Return Books'),
('DAS-0025', '2026-07-29 08:03:06', 'Borrow Books'),
('24-10649', '2026-07-29 14:37:23', 'Borrow Books'),
('24-11238', '2026-08-01 13:02:59', 'Borrow Books'),
('24-11262', '2026-08-01 13:03:07', 'Borrow Books'),
('24-10942', '2026-08-04 08:43:55', 'EXIT CLEARANCE'),
('DTE-0006', '2026-08-26 08:13:32', 'OJT'),
('NTP-0060', '2026-08-27 08:36:40', 'Borrow Books'),
('DAS-0006', '2026-09-18 15:27:09', 'Borrow Books'),
('DAS-0028', '2026-09-21 10:27:45', 'THESIS'),
('DTE-0007', '2026-09-21 10:28:19', 'THESIS'),
('23-8239', '2026-09-21 10:30:15', 'THESIS'),
('23-8055', '2026-09-21 10:30:24', 'THESIS'),
('23-7824', '2026-09-21 10:30:37', 'THESIS'),
('DAS-0029', '2026-09-21 18:38:35', 'THESIS'),
('DTE-0003', '2026-09-23 13:13:44', 'OJT')
;

alter table public.attendance disable trigger guard_attendance;
alter table public.attendance disable trigger activity_capture;

update public.attendance a
   set purpose_of_visit = case lower(btrim(l.purpose))
       when 'borrow books' then 'Borrow Books'
       when 'return books' then 'Return Books'
       when 'thesis' then 'THESIS'
       when 'ojt' then 'OJT'
       when 'exit clearance' then 'EXIT CLEARANCE'
       else a.purpose_of_visit
     end
  from legacy_purpose_fix l
  join public."usersData" u on u.library_id = btrim(l.user_id)
 where a.user_profile_id = u.id
   and a.time_in = (l.time_in::timestamp) at time zone 'Asia/Manila'
   and a.provenance = 'import'
   and a.purpose_of_visit = case lower(btrim(l.purpose))
       when 'borrow books' then 'Borrowing/Returning'
       when 'return books' then 'Borrowing/Returning'
       when 'thesis' then 'Research'
       else 'Others'
     end;

alter table public.attendance enable trigger guard_attendance;
alter table public.attendance enable trigger activity_capture;

select purpose_of_visit, count(*) as visits
from public.attendance
group by 1
order by 2 desc;
commit;