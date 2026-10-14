-- ============================================================================
-- Guest visitors + the library's own purpose list.
--
-- 1. A "guest" visitor type: guests have no library card, so ten reusable
--    guest profiles (GUEST-01..GUEST-10) stand in for the card. The real
--    guest's name (and any other information) is typed on each visit and
--    stored on the attendance record itself.
-- 2. attendance gains guest_name / guest_detail (+ checks + the column
--    insert grants the app needs).
-- 3. The visit rows in the reports carry the guest fields.
-- 4. Purpose data follows the new option list: Studying -> Study,
--    Other -> Others (Borrow Books / Return Books are re-derived from the
--    legacy dump afterwards).
-- ============================================================================
begin;

-- 1) the guest visitor type --------------------------------------------------
alter table public.attendance drop constraint if exists attendance_role_at_visit_check;
alter table public.attendance add constraint attendance_role_at_visit_check
  check (role_at_visit = any (array[
    'student', 'faculty', 'non_teaching_personnel', 'admin', 'librarian',
    'guest']));

-- 2) guest information on the visit ------------------------------------------
alter table public.attendance add column if not exists guest_name text;
alter table public.attendance add column if not exists guest_detail text;

alter table public.attendance drop constraint if exists attendance_guest_check;
alter table public.attendance add constraint attendance_guest_check
  check (
    (role_at_visit = 'guest' and nullif(btrim(guest_name), '') is not null)
    or (role_at_visit <> 'guest' and guest_name is null and guest_detail is null)
  );

grant insert (guest_name, guest_detail) on public.attendance to authenticated;

-- 3) the ten reusable guest profiles ------------------------------------------
insert into public."usersData" (library_id, first_name, surname, role)
select 'GUEST-' || lpad(n::text, 2, '0'), 'Guest', lpad(n::text, 2, '0'), 'guest'
from generate_series(1, 10) n
where not exists (
  select 1 from public."usersData" u
   where u.library_id = 'GUEST-' || lpad(n::text, 2, '0'));

insert into public.provenance_batches
  (label, table_name, criteria, row_count, actor, note)
select 'setup', 'usersData',
       'Ten reusable guest profiles (GUEST-01..GUEST-10) for walk-in visitors without a library card; the real guest name is typed on each visit and stored on the attendance record',
       count(*), 'setup',
       'Guests have no login and no enrollment.'
from public."usersData" where role = 'guest';

-- 4) purpose data follows the new option list ---------------------------------
-- (setup change: the guard and the log stay out of it)
alter table public.attendance disable trigger guard_attendance;
alter table public.attendance disable trigger activity_capture;

update public.attendance set purpose_of_visit = 'Study'
 where purpose_of_visit = 'Studying';
update public.attendance set purpose_of_visit = 'Others'
 where purpose_of_visit = 'Other';

alter table public.attendance enable trigger guard_attendance;
alter table public.attendance enable trigger activity_capture;

-- 5) the visit rows carry the guest fields ------------------------------------
do $$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'lirc_private' and p.proname = 'filtered_attendance';
  if v_def is null then
    raise exception 'lirc_private.filtered_attendance was not found.';
  end if;
  if position('guest_name' in v_def) = 0 then
    v_new := replace(v_def,
      $p$'library_id',u.library_id,'avatar_url',u.avatar_url,$p$,
      $r$'library_id',u.library_id,'avatar_url',u.avatar_url,'guest_name',a.guest_name,'guest_detail',a.guest_detail,$r$);
    if position('guest_name' in v_new) = 0 then
      raise exception 'row pattern not found in filtered_attendance.';
    end if;
    execute v_new;
  end if;
end $$;

notify pgrst, 'reload schema';
commit;
