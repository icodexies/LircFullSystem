-- Allow validation staff to send the typed year level with a validation.
-- The enrollment RLS policies already limit writes to validation staff, and
-- the guard trigger validates the range and status rules.
-- ============================================================================
begin;

grant insert (year_level, year_level_source)
  on public.student_enrollments to authenticated;
grant update (year_level, year_level_source)
  on public.student_enrollments to authenticated;

notify pgrst, 'reload schema';
commit;
