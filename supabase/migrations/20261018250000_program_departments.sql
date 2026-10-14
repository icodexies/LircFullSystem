-- ============================================================================
-- Programs belong to departments.
--
-- The four CCC departments own their degree programs (by program code):
--   DBA — BSA, BSAIS
--   DTE — BEED, BECED, BSED, BSE-E/F/M/S/SS
--   DCI — BSCS, BSIT
--   DAS — BSPSY
--
-- Every member with one of these programs gets that department in
-- usersData.department_id (currently unset for all of them).
-- BSP and BS-F are not in the college's program list — they stay unassigned
-- until the registrar classifies them.
--
-- The bulk classification is a setup change, not user activity, so the
-- activity trigger is off during the update (it re-enables automatically on
-- rollback as well).
-- ============================================================================
begin;

alter table public.programs
  add column if not exists department_id bigint
  references public.departments(id);

update public.programs p
   set department_id = (
         select d.id from public.departments d
          where d.name like 'DBA%' order by d.id limit 1)
 where p.name in ('BSA', 'BSAIS');

update public.programs p
   set department_id = (
         select d.id from public.departments d
          where d.name like 'DTE%' order by d.id limit 1)
 where p.name in ('BEED', 'BECED', 'BSED', 'BSE-E', 'BSE-F', 'BSE-M',
                  'BSE-S', 'BSE-SS');

update public.programs p
   set department_id = (
         select d.id from public.departments d
          where d.name like 'DCI%' order by d.id limit 1)
 where p.name in ('BSCS', 'BSIT');

update public.programs p
   set department_id = (
         select d.id from public.departments d
          where d.name like 'DAS%' order by d.id limit 1)
 where p.name in ('BSPSY');

alter table public."usersData" disable trigger activity_capture;

update public."usersData" u
   set department_id = p.department_id
  from public.programs p
 where u.program_id = p.id
   and p.department_id is not null
   and u.department_id is distinct from p.department_id;

alter table public."usersData" enable trigger activity_capture;

notify pgrst, 'reload schema';
commit;
