-- ============================================================================
-- Profile avatars: an optional photo per member, shown in the header and on
-- the profile page, with the library fallback image when none is chosen.
--
-- 1. usersData.avatar_url (text; null = fallback image).
-- 2. A public 'avatars' storage bucket; members manage files in their own
--    folder (their auth uid).
-- 3. lirc_set_my_avatar(url) — the only way to set it (usersData has no
--    update policy); validates preset paths and the bucket's public URL.
-- 4. lirc_my_profile() now includes avatar_url.
-- ============================================================================
begin;

alter table public."usersData"
  add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152,
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "LIRC avatars manage own folder" on storage.objects;
create policy "LIRC avatars manage own folder" on storage.objects
  for all to authenticated
  using (bucket_id = 'avatars'
         and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create or replace function public.lirc_set_my_avatar(p_url text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me bigint := lirc_private.my_profile_id();
  v_url text := nullif(btrim(coalesce(p_url, '')), '');
begin
  if v_me is null then
    raise exception 'No library profile for this account.' using errcode = '42501';
  end if;
  if v_url is not null
     and v_url not like '/images/profiles/%'
     and v_url not like '%/object/public/avatars/%' then
    raise exception 'That image address is not allowed.';
  end if;
  update public."usersData" set avatar_url = v_url where id = v_me;
  return jsonb_build_object('avatar_url', v_url);
end $$;
revoke all on function public.lirc_set_my_avatar(text) from public, anon;
grant execute on function public.lirc_set_my_avatar(text) to authenticated;

create or replace function public.lirc_my_profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me bigint := lirc_private.my_profile_id();
  u public."usersData"%ROWTYPE;
begin
  if v_me is null then
    raise exception 'No library profile for this account.' using errcode = '42501';
  end if;
  select * into u from public."usersData" where id = v_me;
  return jsonb_build_object(
    'id', u.id,
    'full_name', concat_ws(' ', u.first_name, u.middle_initial, u.surname, u.suffix),
    'first_name', u.first_name,
    'middle_initial', u.middle_initial,
    'surname', u.surname,
    'suffix', u.suffix,
    'library_id', u.library_id,
    'role', u.role,
    'avatar_url', u.avatar_url,
    'department', (select d.name from public.departments d where d.id = u.department_id),
    'program', (select p.name from public.programs p where p.id = u.program_id),
    'position', (select pc.name from public.position_classifications pc
                  where pc.id = u.position_classification_id),
    'email', (select au.email from auth.users au where au.id = u.user_id));
end $$;
revoke all on function public.lirc_my_profile() from public, anon;
grant execute on function public.lirc_my_profile() to authenticated;

notify pgrst, 'reload schema';
commit;
