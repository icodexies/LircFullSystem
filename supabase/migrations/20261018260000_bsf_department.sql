-- ============================================================================
-- Registrar follow-up: BS-F belongs to the Department of Teacher Education.
-- (BSPSY was already set to DAS in the previous migration; BSP stays
-- unassigned until the registrar classifies it.)
--
-- The bulk classification runs with the activity trigger off (setup change),
-- then the one affected member gets the department.
-- ============================================================================
begin;

update public.programs p
   set department_id = (
         select d.id from public.departments d
          where d.name like 'DTE%' order by d.id limit 1)
 where p.name = 'BS-F'
   and p.department_id is null;

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
