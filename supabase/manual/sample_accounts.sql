-- ============================================================================
-- Sample accounts on request: one faculty and one student, created the same
-- way the app does it — the library card exists first, the auth account is
-- linked to it, and the student's library validation for the current school
-- year is recorded so every flow (time in, borrow) works.
--
--   faculty@ccc.edu.ph / Faculty#2026  → card FAC-0001 · Faye M. Aguilar
--   student@ccc.edu.ph / Student#2026  → card 26-00001 · Sam D. Villanueva
--
-- Safe to re-run: every step skips when the row already exists.
-- ============================================================================
begin;

-- 1) Library cards -----------------------------------------------------------
insert into public."usersData"
  (library_id, first_name, middle_initial, surname, role,
   department_id, program_id, position_classification_id, provenance)
select 'FAC-0001', 'Faye', 'M', 'Aguilar', 'faculty',
       (select id from public.departments where name like 'DAS%' limit 1),
       null,
       (select id from public.position_classifications where name = 'Full Time' limit 1),
       'setup'
where not exists (
  select 1 from public."usersData" where library_id = 'FAC-0001');

insert into public."usersData"
  (library_id, first_name, middle_initial, surname, role,
   department_id, program_id, position_classification_id, provenance)
select '26-00001', 'Sam', 'D', 'Villanueva', 'student',
       (select id from public.departments where name like 'DCI%' limit 1),
       (select id from public.programs where name = 'BSIT' limit 1),
       null,
       'setup'
where not exists (
  select 1 from public."usersData" where library_id = '26-00001');

-- 2) Auth accounts (confirmed; bcrypt password, like the existing samples) ---
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
       'authenticated', 'authenticated', v.email,
       crypt(v.password, gen_salt('bf')), now(),
       '{"provider": "email", "providers": ["email"]}'::jsonb,
       jsonb_build_object('library_id', v.library_id, 'first_name', v.first_name,
                          'surname', v.surname, 'email_verified', true),
       now(), now(), '', '', '', ''
from (values
  ('faculty@ccc.edu.ph', 'Faculty#2026', 'FAC-0001', 'Faye', 'Aguilar'),
  ('student@ccc.edu.ph', 'Student#2026', '26-00001', 'Sam', 'Villanueva')
) as v(email, password, library_id, first_name, surname)
where not exists (
  select 1 from auth.users u where u.email = v.email);

-- 3) Email identities (GoTrue signs in through these) ------------------------
insert into auth.identities (user_id, provider_id, identity_data, provider, created_at, updated_at)
select u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email,
                          'email_verified', true, 'phone_verified', false),
       'email', now(), now()
from auth.users u
where u.email in ('faculty@ccc.edu.ph', 'student@ccc.edu.ph')
  and not exists (
    select 1 from auth.identities i
    where i.user_id = u.id and i.provider = 'email');

-- 4) Link the cards to the accounts ------------------------------------------
update public."usersData" p
   set user_id = (select u.id from auth.users u where u.email = 'faculty@ccc.edu.ph')
 where p.library_id = 'FAC-0001' and p.user_id is null;
update public."usersData" p
   set user_id = (select u.id from auth.users u where u.email = 'student@ccc.edu.ph')
 where p.library_id = '26-00001' and p.user_id is null;

-- 5) The sample student's library validation (the guard needs a signed-in
--    librarian/admin, so act as the admin for this row) ----------------------
do $$
declare
  v_admin uuid;
begin
  select u.user_id into v_admin
  from public."usersData" u
  where lower(btrim(u.role::text)) = 'admin' and u.user_id is not null
  limit 1;
  if v_admin is null then
    raise exception 'No admin account is linked; cannot record the sample validation.';
  end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin::text, 'role', 'authenticated')::text, true);
  insert into public.student_enrollments (user_profile_id, academic_year_id, status)
  select p.id, ay.id, 'enrolled'
  from public."usersData" p, public.academic_years ay
  where p.library_id = '26-00001' and ay.name = '2026-2027'
    and not exists (
      select 1 from public.student_enrollments e
      where e.user_profile_id = p.id and e.academic_year_id = ay.id);
end $$;

-- 6) Provenance note ---------------------------------------------------------
insert into public.provenance_batches (label, table_name, criteria, row_count, actor, note)
select 'setup', 'usersData',
       'Sample faculty and student accounts created on request (FAC-0001 Faye M. Aguilar · 26-00001 Sam D. Villanueva) with linked auth accounts',
       count(*), 'setup',
       'Passwords are shared with the requester only.'
from public."usersData"
where library_id in ('FAC-0001', '26-00001');

-- 7) Sample admin account (for settings like fines) -------------------------
--    admin@ccc.edu.ph  -> card ADM-0001 — Alex R. Mendoza
--    Set a unique password below before running; never commit it.
insert into public."usersData"
  (library_id, first_name, middle_initial, surname, role, provenance)
select 'ADM-0001', 'Alex', 'R', 'Mendoza', 'admin', 'setup'
where not exists (
  select 1 from public."usersData" where library_id = 'ADM-0001');

insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
       'authenticated', 'authenticated', 'admin@ccc.edu.ph',
       crypt('CHANGE_ME_ADMIN_PASSWORD', gen_salt('bf')), now(),
       '{"provider": "email", "providers": ["email"]}'::jsonb,
       jsonb_build_object('library_id', 'ADM-0001', 'first_name', 'Alex',
                          'surname', 'Mendoza', 'email_verified', true),
       now(), now(), '', '', '', ''
where not exists (
  select 1 from auth.users u where u.email = 'admin@ccc.edu.ph');

insert into auth.identities (user_id, provider_id, identity_data, provider, created_at, updated_at)
select u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email,
                          'email_verified', true, 'phone_verified', false),
       'email', now(), now()
from auth.users u
where u.email = 'admin@ccc.edu.ph'
  and not exists (
    select 1 from auth.identities i
    where i.user_id = u.id and i.provider = 'email');

update public."usersData" p
   set user_id = (select u.id from auth.users u where u.email = 'admin@ccc.edu.ph')
 where p.library_id = 'ADM-0001' and p.user_id is null;

insert into public.provenance_batches (label, table_name, criteria, row_count, actor, note)
select 'setup', 'usersData',
       'Sample admin account created on request (ADM-0001 Alex R. Mendoza) with a linked auth account',
       count(*), 'setup',
       'Passwords are shared with the requester only.'
from public."usersData"
where library_id = 'ADM-0001';

commit;
