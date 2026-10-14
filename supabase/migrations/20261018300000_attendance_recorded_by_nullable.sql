-- ============================================================================
-- attendance.recorded_by becomes nullable.
--
-- Legacy visits imported from the previous system have no operator on record;
-- attributing them to a real person would be false. The app's own visits
-- always carry a recorder (the guard trigger sets it), so nothing changes
-- for live records.
-- ============================================================================
begin;

alter table public.attendance
  alter column recorded_by drop not null;

notify pgrst, 'reload schema';
commit;
