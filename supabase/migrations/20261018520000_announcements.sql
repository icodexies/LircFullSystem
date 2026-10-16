-- ============================================================================
-- Announcement board.
--
-- Admins write announcements on the Announcements page. Published ones pop
-- up in a carousel when members (students, faculty, staff) open the system
-- after signing in — once per browser session. Audience targets the popup:
-- everyone, students, or faculty; "Show until" hides it automatically.
--
--   announcements            - title, body, optional image, audience, pin,
--                              draft/published, starts_at / ends_at
--   announcement-images      - public bucket; admins upload prepared WebP
--                              files (insert-only, never overwrite/delete)
--
-- RPCs: lirc_announcements_feed (members), lirc_announcements_manage,
-- lirc_announcement_save, lirc_announcement_set_status, lirc_announcement_delete
-- (admins). All tables are RPC-only, matching the other modules.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists public.announcements (
  id bigint generated always as identity primary key,
  title text not null,
  body text not null,
  audience text not null default 'all'
    check (audience in ('all', 'students', 'faculty')),
  image_url text,
  pinned boolean not null default false,
  status text not null default 'draft'
    check (status in ('draft', 'published')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_by bigint references public."usersData"(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists announcements_feed_idx
  on public.announcements (status, starts_at desc);
create index if not exists announcements_manage_idx
  on public.announcements (updated_at desc);

alter table public.announcements enable row level security;
revoke all privileges on table public.announcements from public, anon, authenticated;
grant all privileges on table public.announcements to service_role;

-- ---------------------------------------------------------------------------
-- RPC: the popup feed for the signed-in member (active + their audience)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_announcements_feed()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me public."usersData"%ROWTYPE;
  v_audience text;
begin
  select * into v_me from public."usersData"
  where id = lirc_private.my_profile_id();
  if not found then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  v_audience := case lower(btrim(v_me.role::text))
                  when 'student' then 'students'
                  when 'faculty' then 'faculty'
                  else null
                end;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id,
      'title', a.title,
      'body', a.body,
      'image_url', a.image_url,
      'audience', a.audience,
      'pinned', a.pinned,
      'starts_at', a.starts_at,
      'ends_at', a.ends_at)
      order by a.pinned desc, a.starts_at desc, a.id desc)
    from (
      select * from public.announcements
      where status = 'published'
        and (starts_at is null or starts_at <= now())
        and (ends_at is null or ends_at >= now())
        and (audience = 'all' or audience = v_audience)
      order by pinned desc, starts_at desc, id desc
      limit 12
    ) a
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: every announcement for the admin page
-- ---------------------------------------------------------------------------
create or replace function public.lirc_announcements_manage()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not lirc_private.is_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id,
      'title', a.title,
      'body', a.body,
      'audience', a.audience,
      'image_url', a.image_url,
      'pinned', a.pinned,
      'status', a.status,
      'starts_at', a.starts_at,
      'ends_at', a.ends_at,
      'created_at', a.created_at,
      'updated_at', a.updated_at,
      'created_by_name', (
        select btrim(u.first_name || ' ' || u.surname)
        from public."usersData" u where u.id = a.created_by),
      'expired', (a.status = 'published' and a.ends_at is not null and a.ends_at < now())
      ) order by a.pinned desc, a.updated_at desc)
    from public.announcements a
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: create or update an announcement (admins)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_announcement_save(
  p_id bigint default null,
  p_title text default '',
  p_body text default '',
  p_audience text default 'all',
  p_image_url text default null,
  p_pinned boolean default false,
  p_ends_on date default null,
  p_publish boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_audience text := lower(btrim(coalesce(p_audience, 'all')));
  v_image text := nullif(btrim(coalesce(p_image_url, '')), '');
  v_ends timestamptz;
  v_id bigint;
  a public.announcements%ROWTYPE;
begin
  if not lirc_private.is_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  if v_title = '' or length(v_title) > 150 then
    raise exception 'Enter a title (1-150 characters).';
  end if;
  if v_body = '' or length(v_body) > 2000 then
    raise exception 'Enter the announcement text (1-2000 characters).';
  end if;
  if v_audience not in ('all', 'students', 'faculty') then
    raise exception 'Choose who sees this announcement.';
  end if;
  if v_image is not null and v_image !~ '^https?://' then
    raise exception 'Invalid image link.';
  end if;
  -- "Show until" includes the whole chosen day (Philippine time).
  if p_ends_on is not null then
    v_ends := (p_ends_on::text || 'T00:00:00+08:00')::timestamptz + interval '1 day';
  end if;

  if p_id is null then
    insert into public.announcements
      (title, body, audience, image_url, pinned, status, starts_at, ends_at, created_by)
    values
      (v_title, v_body, v_audience, v_image, coalesce(p_pinned, false),
       case when p_publish then 'published' else 'draft' end,
       case when p_publish then now() else null end,
       v_ends, lirc_private.my_profile_id())
    returning id into v_id;
  else
    select * into a from public.announcements where id = p_id for update;
    if not found then
      raise exception 'Announcement not found.';
    end if;
    update public.announcements
       set title = v_title,
           body = v_body,
           audience = v_audience,
           image_url = v_image,
           pinned = coalesce(p_pinned, false),
           ends_at = v_ends,
           status = case when p_publish then 'published' else 'draft' end,
           starts_at = case
             when p_publish then coalesce(a.starts_at, now())
             else null
           end,
           updated_at = now()
     where id = p_id;
    v_id := p_id;
  end if;
  return jsonb_build_object('id', v_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: publish / unpublish from the list (admins)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_announcement_set_status(
  p_id bigint, p_publish boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.announcements%ROWTYPE;
begin
  if not lirc_private.is_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  select * into a from public.announcements where id = p_id for update;
  if not found then
    raise exception 'Announcement not found.';
  end if;
  update public.announcements
     set status = case when p_publish then 'published' else 'draft' end,
         starts_at = case when p_publish then coalesce(a.starts_at, now()) else null end,
         updated_at = now()
   where id = p_id;
  return jsonb_build_object(
    'id', p_id,
    'status', case when p_publish then 'published' else 'draft' end);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: delete an announcement (admins)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_announcement_delete(p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not lirc_private.is_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  delete from public.announcements where id = p_id;
  if not found then
    raise exception 'Announcement not found.';
  end if;
  return jsonb_build_object('deleted', p_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Announcement images: public bucket, admin uploads only (insert-only)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('announcement-images', 'announcement-images', true, 524288, array['image/webp'])
on conflict (id) do nothing;

create policy "LIRC announcement images insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'announcement-images' and (select lirc_private.is_admin())
    and name ~ '^[0-9a-f-]{36}\.webp$');

-- Clients may insert but never overwrite or delete announcement images.
create policy "LIRC announcement images boundary" on storage.objects as restrictive
  for all to authenticated
  using (bucket_id <> 'announcement-images')
  with check (bucket_id <> 'announcement-images' or (
    (select lirc_private.is_admin())
    and name ~ '^[0-9a-f-]{36}\.webp$'
  ));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function public.lirc_announcements_feed() from public, anon, authenticated;
revoke all on function public.lirc_announcements_manage() from public, anon, authenticated;
revoke all on function public.lirc_announcement_save(bigint, text, text, text, text, boolean, date, boolean) from public, anon, authenticated;
revoke all on function public.lirc_announcement_set_status(bigint, boolean) from public, anon, authenticated;
revoke all on function public.lirc_announcement_delete(bigint) from public, anon, authenticated;

grant execute on function public.lirc_announcements_feed(),
  public.lirc_announcements_manage(),
  public.lirc_announcement_save(bigint, text, text, text, text, boolean, date, boolean),
  public.lirc_announcement_set_status(bigint, boolean),
  public.lirc_announcement_delete(bigint)
  to authenticated;

commit;
