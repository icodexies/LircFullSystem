-- "Show until" keeps the whole chosen day (Philippine time) and the date the
-- admin picked is the date everyone sees. The first version stored the next
-- midnight (exclusive boundary), so a "Show until Oct 23" announcement read
-- "shown until Oct 24". Store the last visible moment instead and correct
-- the rows created by the old version.
begin;

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
  -- "Show until" includes the whole chosen day (Philippine time): the last
  -- visible moment is that day's 23:59:59.999.
  if p_ends_on is not null then
    v_ends := (p_ends_on::text || 'T23:59:59.999+08:00')::timestamptz;
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

revoke all on function public.lirc_announcement_save(bigint, text, text, text, text, boolean, date, boolean) from public, anon, authenticated;
grant execute on function public.lirc_announcement_save(bigint, text, text, text, text, boolean, date, boolean) to authenticated;

-- Correct rows saved by the old version: a "Show until" that stored exactly
-- Manila midnight moves to the previous day's last moment.
update public.announcements
   set ends_at = ends_at - interval '1 millisecond'
 where ends_at is not null
   and (ends_at at time zone 'Asia/Manila')::time = time '00:00:00';

commit;
