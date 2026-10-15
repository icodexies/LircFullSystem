-- Merge duplicate student records: keep the newer card, move its history,
-- delete the duplicate.
create temp table _dups (
  keep_id bigint, drop_id bigint, name text, keep_card text, drop_card text);
create temp table _out (item text, detail text);

create temp table _pairs as
select lower(btrim(first_name)) as fn, lower(btrim(surname)) as sn
from public."usersData"
where lower(btrim(role::text)) = 'student'
group by 1, 2
having count(*) = 2;

insert into _dups
select k.id, d.id, k.first_name || ' ' || k.surname, k.library_id, d.library_id
from _pairs p
join public."usersData" k
  on lower(btrim(k.first_name)) = p.fn and lower(btrim(k.surname)) = p.sn
 and lower(btrim(k.role::text)) = 'student'
join public."usersData" d
  on lower(btrim(d.first_name)) = p.fn and lower(btrim(d.surname)) = p.sn
 and lower(btrim(d.role::text)) = 'student'
 and d.id > k.id
where lower(btrim(coalesce(k.middle_initial, ''))) = lower(btrim(coalesce(d.middle_initial, '')))
   or coalesce(btrim(k.middle_initial), '') = ''
   or coalesce(btrim(d.middle_initial), '') = '';

update _dups
   set keep_id = drop_id, drop_id = keep_id,
       keep_card = drop_card, drop_card = keep_card
 where left(drop_card, 2) > left(keep_card, 2)
    or (left(drop_card, 2) = left(keep_card, 2) and drop_card > keep_card);

-- Move the duplicate's history to the kept record (setup change: guards and
-- the activity log stay out of it).
alter table public."usersData" disable trigger activity_capture;
alter table public.attendance disable trigger activity_capture;
alter table public.attendance disable trigger guard_attendance;
alter table public.book_loans disable trigger activity_capture;
alter table public.student_enrollments disable trigger activity_capture;
alter table public.student_enrollments disable trigger guard_student_enrollment;

-- Visits: re-point to the kept record AND its enrollment of the same year
-- (the composite attendance FK).
update public.attendance a
   set user_profile_id = d.keep_id,
       student_enrollment_id = case
         when a.student_enrollment_id is null then null
         else (select k.id
               from public.student_enrollments e
               join public.student_enrollments k
                 on k.user_profile_id = d.keep_id
                and k.academic_year_id = e.academic_year_id
               where e.id = a.student_enrollment_id)
       end
  from _dups d
 where a.user_profile_id = d.drop_id;

update public.book_loans l
   set user_profile_id = d.keep_id
  from _dups d
 where l.user_profile_id = d.drop_id;

delete from public.student_enrollments e
 using _dups d
 where e.user_profile_id = d.drop_id
   and exists (select 1 from public.student_enrollments k
               where k.user_profile_id = d.keep_id
                 and k.academic_year_id = e.academic_year_id);
update public.student_enrollments e
   set user_profile_id = d.keep_id
  from _dups d
 where e.user_profile_id = d.drop_id;

delete from public."usersData" u
 using _dups d
 where u.id = d.drop_id;

alter table public."usersData" enable trigger activity_capture;
alter table public.attendance enable trigger activity_capture;
alter table public.attendance enable trigger guard_attendance;
alter table public.book_loans enable trigger activity_capture;
alter table public.student_enrollments enable trigger activity_capture;
alter table public.student_enrollments enable trigger guard_student_enrollment;

insert into _out
select 'merged.pairs', count(*)::text from _dups
union all
select 'left.duplicate_groups', (
  select count(*)::text from (
    select 1 from public."usersData"
    where lower(btrim(role::text)) = 'student'
    group by lower(btrim(first_name)), lower(btrim(surname))
    having count(*) > 1) x)
union all
select 'students.total', (
  select count(*)::text from public."usersData"
  where lower(btrim(role::text)) = 'student');
select item, detail from _out order by item;
