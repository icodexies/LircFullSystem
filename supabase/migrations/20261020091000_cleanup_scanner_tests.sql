-- Removes the attendance records created while verifying the scanner toasts,
-- the display names and the station colours (sample student 26-00001, recorded
-- from the staff scanner and the attendance station during the test run).
-- ============================================================================
begin;

delete from public.attendance
 where user_profile_id = 10034
   and id > 46049
   and recorded_by in (
     select id from public."usersData"
     where library_id in ('LIB-0003', 'SYS-A1'));

notify pgrst, 'reload schema';
commit;
