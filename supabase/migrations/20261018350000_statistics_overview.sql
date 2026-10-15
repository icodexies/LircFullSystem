-- ============================================================================
-- Statistics overview: every number the Statistics cards show, in one call.
--
-- Read-only and aggregate only (no personal data): catalog sizes and
-- availability, borrowing states, member counts by role, current-year
-- validation progress, and the active semester's visits. Any signed-in
-- member may call it (the Statistics page is a member page); the grant is
-- authenticated-only, so anonymous access is impossible.
-- ============================================================================
begin;

create or replace function public.lirc_statistics_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sem public.semesters%ROWTYPE;
  v_year_name text;
begin
  select * into v_sem from public.semesters where is_active limit 1;
  if v_sem.id is not null then
    select ay.name into v_year_name
    from public.academic_years ay where ay.id = v_sem.academic_year_id;
  end if;

  return jsonb_build_object(
    'catalog', jsonb_build_object(
      'titles', (select count(*) from public.books),
      'copies', (select count(*) from public.book_accession_numbers),
      'available', (
        select count(*)
        from public.book_accession_numbers a
        where (a.status is null
               or lower(btrim(a.status)) in ('', 'available'))
          and not exists (
            select 1 from public.book_loans l
            where l.accession_id = a.id and l.returned_at is null))),
    'borrowing', jsonb_build_object(
      'total', (select count(*) from public.book_loans),
      'open', (select count(*) from public.book_loans where returned_at is null),
      'overdue', (
        select count(*) from public.book_loans
        where returned_at is null and due_at < now()),
      'returned', (
        select count(*) from public.book_loans where returned_at is not null)),
    'members', jsonb_build_object(
      'total', (select count(*) from public."usersData"),
      'by_role', (
        select coalesce(jsonb_object_agg(x.role, x.n), '{}'::jsonb)
        from (
          select lower(btrim(role::text)) as role, count(*) as n
          from public."usersData"
          group by 1) x),
      'students', (
        select count(*) from public."usersData"
        where lower(btrim(role::text)) = 'student')),
    'validation', jsonb_build_object(
      'year_name', v_year_name,
      'records', (
        select count(*) from public.student_enrollments
        where academic_year_id = v_sem.academic_year_id),
      'validated', (
        select count(*) from public.student_enrollments
        where academic_year_id = v_sem.academic_year_id
          and status = 'enrolled'
          and validated_at is not null)),
    'attendance', jsonb_build_object(
      'semester_id', v_sem.id,
      'semester_name', v_sem.name,
      'semester_year', v_year_name,
      'visits', (
        select count(*) from public.attendance
        where semester_id = v_sem.id),
      'unique_visitors', (
        select count(distinct user_profile_id) from public.attendance
        where semester_id = v_sem.id),
      'inside', (
        select count(*) from public.attendance where time_out is null)));
end $$;

revoke all on function public.lirc_statistics_overview() from public, anon;
grant execute on function public.lirc_statistics_overview() to authenticated;

notify pgrst, 'reload schema';
commit;
