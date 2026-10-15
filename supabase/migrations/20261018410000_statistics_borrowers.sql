-- ============================================================================
-- Borrower statistics: a sixth category for the cards — the people side of
-- borrowing. One member's own record already has its own function
-- (lirc_statistics_borrower); this one covers the group:
--
--   * lirc_statistics_borrowers(p_semester_id) — for the semester's loans:
--     how many people borrowed (and how many did more than once / for the
--     first time), the average loans per borrower, the top twenty borrowers,
--     who has books overdue right now, borrowers by role and by department.
--   * lirc_statistics_overview gains a matching `borrowers` summary so the
--     new card can show its headline numbers with the rest.
--
-- All aggregates; guarded to staff / librarian / admin.
-- ============================================================================
begin;

-- The original no-argument versions (before semester scoping) are superseded
-- by the semester-aware ones; drop them so nothing can ever resolve to a
-- stale definition.
drop function if exists public.lirc_statistics_overview();
drop function if exists public.lirc_statistics_borrowing();
drop function if exists public.lirc_statistics_attendance();

create or replace function public.lirc_statistics_borrowers(
  p_semester_id bigint default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sem public.semesters%ROWTYPE;
  v_start timestamptz;
  v_end timestamptz;
begin
  if lirc_private.library_operator_id() is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  if p_semester_id is not null then
    select * into v_sem from public.semesters where id = p_semester_id;
  end if;
  if v_sem.id is null then
    select * into v_sem from public.semesters where is_active limit 1;
  end if;
  if v_sem.id is not null then
    v_start := v_sem.starts_on::timestamp at time zone 'Asia/Manila';
    v_end := (v_sem.ends_on + 1)::timestamp at time zone 'Asia/Manila';
  end if;

  return jsonb_build_object(
    'semester', jsonb_build_object(
      'id', v_sem.id,
      'name', v_sem.name,
      'year', (select ay.name from public.academic_years ay
               where ay.id = v_sem.academic_year_id)),
    'totals', jsonb_build_object(
      'borrowers', (
        select count(distinct l.user_profile_id)
        from public.book_loans l
        where v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end),
      'loans', (
        select count(*) from public.book_loans l
        where v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end),
      'avg_loans', (
        select round(count(*)::numeric
                     / greatest(count(distinct l.user_profile_id), 1), 1)
        from public.book_loans l
        where v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end),
      'repeat', (
        select count(*) from (
          select l.user_profile_id
          from public.book_loans l
          where v_start is not null
            and l.borrowed_at >= v_start and l.borrowed_at < v_end
          group by l.user_profile_id
          having count(*) > 1) x),
      'first_time', (
        select count(*) from (
          select l.user_profile_id
          from public.book_loans l
          where v_start is not null
            and l.borrowed_at >= v_start and l.borrowed_at < v_end
          group by l.user_profile_id) b
        where not exists (
          select 1 from public.book_loans before
          where before.user_profile_id = b.user_profile_id
            and before.borrowed_at < v_start)),
      'with_overdue', (
        select count(distinct l.user_profile_id)
        from public.book_loans l
        where v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end
          and l.returned_at is null and l.due_at < now())),
    'top_borrowers', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', x.id,
          'name', concat_ws(' ', x.first_name, x.middle_initial,
                            x.surname, x.suffix),
          'library_id', x.library_id,
          'role', lower(btrim(x.role::text)),
          'count', x.n) order by x.n desc, x.surname, x.first_name), '[]'::jsonb)
      from (
        select u.id, u.first_name, u.middle_initial, u.surname, u.suffix,
               u.library_id, u.role, count(*) as n
        from public.book_loans l
        join public."usersData" u on u.id = l.user_profile_id
        where v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end
        group by u.id
        order by count(*) desc, u.surname, u.first_name
        limit 20) x),
    'overdue_now', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', x.id,
          'name', x.name,
          'library_id', x.library_id,
          'role', x.role,
          'count', x.n,
          'days', x.days) order by x.days desc, x.name), '[]'::jsonb)
      from (
        select u.id,
               concat_ws(' ', u.first_name, u.middle_initial,
                         u.surname, u.suffix) as name,
               u.library_id, lower(btrim(u.role::text)) as role,
               count(*) as n,
               floor(extract(epoch from (now() - min(l.due_at))) / 86400)::int as days
        from public.book_loans l
        join public."usersData" u on u.id = l.user_profile_id
        where v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end
          and l.returned_at is null and l.due_at < now()
        group by u.id
        order by days desc, name
        limit 10) x),
    'by_role', (
      select coalesce(jsonb_agg(jsonb_build_object('label', x.role, 'count', x.n)
                                order by x.n desc, x.role), '[]'::jsonb)
      from (
        select lower(btrim(u.role::text)) as role,
               count(distinct l.user_profile_id) as n
        from public.book_loans l
        join public."usersData" u on u.id = l.user_profile_id
        where v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end
        group by 1) x),
    'by_department', (
      select coalesce(jsonb_agg(jsonb_build_object('label', x.label, 'count', x.n)
                                order by x.n desc, x.label), '[]'::jsonb)
      from (
        select coalesce(d.name, '(No department)') as label,
               count(distinct l.user_profile_id) as n
        from public.book_loans l
        join public."usersData" u on u.id = l.user_profile_id
        left join public.departments d on d.id = u.department_id
        where v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end
        group by 1
        order by n desc, label
        limit 10) x));
end $$;
revoke all on function public.lirc_statistics_borrowers(bigint) from public, anon;
grant execute on function public.lirc_statistics_borrowers(bigint) to authenticated;

-- The overview gains the matching summary for the new card.
do $$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'lirc_statistics_overview'
    and p.pronargs = 1;
  if v_def is null then
    raise exception 'lirc_statistics_overview was not found.';
  end if;
  if position('''borrowers'', jsonb_build_object' in v_def) > 0 then
    raise notice 'overview already carries the borrowers summary.';
  else
    v_new := replace(v_def,
      $p$'members', jsonb_build_object($p$,
      $r$'borrowers', jsonb_build_object(
      'borrowers', (
        select count(distinct l.user_profile_id) from public.book_loans l
        where v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end),
      'loans', (
        select count(*) from public.book_loans l
        where v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end),
      'avg_loans', (
        select round(count(*)::numeric
                     / greatest(count(distinct l.user_profile_id), 1), 1)
        from public.book_loans l
        where v_start is not null
          and l.borrowed_at >= v_start and l.borrowed_at < v_end),
      'repeat', (
        select count(*) from (
          select l.user_profile_id from public.book_loans l
          where v_start is not null
            and l.borrowed_at >= v_start and l.borrowed_at < v_end
          group by l.user_profile_id
          having count(*) > 1) x)),
    'members', jsonb_build_object($r$);
    if position('''borrowers'', jsonb_build_object' in v_new) = 0 then
      raise exception 'members pattern not found in lirc_statistics_overview.';
    end if;
    execute v_new;
  end if;
end $$;

notify pgrst, 'reload schema';
commit;
