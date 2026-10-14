-- ============================================================================
-- Sample login accounts for testing role-scoped screens (dev/demo only).
--
--   Librarian: librarian@ccc.edu.ph / Librarian#2026   (card LIB-0002)
--   Staff:     staff@ccc.edu.ph     / Staff#2026       (card LIB-0003)
--
-- Each account gets the built-in Supabase auth user (password already
-- confirmed — no email is sent) and the matching public."usersData" profile
-- linked by user_id, so the app's role rules apply immediately.
-- Safe to re-run: anything that already exists is left untouched.
--
-- Run: npx supabase db query --linked -f supabase/manual/lirc_sample_staff_librarian_accounts.sql
-- ============================================================================
do $$
declare
  v_instance uuid := '00000000-0000-0000-0000-000000000000';
  v_librarian uuid := gen_random_uuid();
  v_staff uuid := gen_random_uuid();
begin
  -- Librarian --------------------------------------------------------------
  if not exists (select 1 from auth.users where email = 'librarian@ccc.edu.ph') then
    insert into auth.users
      (instance_id, id, aud, role, email, encrypted_password,
       email_confirmed_at, created_at, updated_at,
       raw_app_meta_data, raw_user_meta_data,
       confirmation_token, recovery_token, email_change, email_change_token_new)
    values
      (v_instance, v_librarian, 'authenticated', 'authenticated',
       'librarian@ccc.edu.ph',
       extensions.crypt('Librarian#2026', extensions.gen_salt('bf')),
       now(), now(), now(),
       '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
       '', '', '', '');
    insert into auth.identities
      (user_id, identity_data, provider, provider_id,
       last_sign_in_at, created_at, updated_at)
    values
      (v_librarian,
       jsonb_build_object('sub', v_librarian::text,
                          'email', 'librarian@ccc.edu.ph',
                          'email_verified', true, 'phone_verified', false),
       'email', v_librarian::text, now(), now(), now());
    insert into public."usersData"
      (library_id, first_name, surname, middle_initial, role, user_id)
    values ('LIB-0002', 'Maria', 'Reyes', 'S', 'librarian', v_librarian);
    raise notice 'created librarian@ccc.edu.ph (LIB-0002)';
  else
    raise notice 'librarian@ccc.edu.ph already exists — skipped';
  end if;

  -- Staff ------------------------------------------------------------------
  if not exists (select 1 from auth.users where email = 'staff@ccc.edu.ph') then
    insert into auth.users
      (instance_id, id, aud, role, email, encrypted_password,
       email_confirmed_at, created_at, updated_at,
       raw_app_meta_data, raw_user_meta_data,
       confirmation_token, recovery_token, email_change, email_change_token_new)
    values
      (v_instance, v_staff, 'authenticated', 'authenticated',
       'staff@ccc.edu.ph',
       extensions.crypt('Staff#2026', extensions.gen_salt('bf')),
       now(), now(), now(),
       '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
       '', '', '', '');
    insert into auth.identities
      (user_id, identity_data, provider, provider_id,
       last_sign_in_at, created_at, updated_at)
    values
      (v_staff,
       jsonb_build_object('sub', v_staff::text,
                          'email', 'staff@ccc.edu.ph',
                          'email_verified', true, 'phone_verified', false),
       'email', v_staff::text, now(), now(), now());
    insert into public."usersData"
      (library_id, first_name, surname, middle_initial, role, user_id)
    values ('LIB-0003', 'Pedro', 'Santos', 'D', 'staff', v_staff);
    raise notice 'created staff@ccc.edu.ph (LIB-0003)';
  else
    raise notice 'staff@ccc.edu.ph already exists — skipped';
  end if;
end $$;
