-- Removes the attendance records created while re-testing the race-condition
-- fix (station scans for the sample student, ids 46019-46022). The station
-- accounts stay; they are ready for real use.
-- ============================================================================
begin;

delete from public.attendance
 where recorded_by = (select id from public."usersData" where library_id = 'SYS-A1')
   and id > 46018;

notify pgrst, 'reload schema';
commit;
