-- ============================================================================
-- Attendance display names: "Surname, Firstname M." (guests read "Guest 01").
--
-- The desk scanner formats names in the browser; this brings the station
-- functions in line, so the station feedback and its recent-visits list use
-- the same format. lirc_private.person_name is the single source of truth.
-- ============================================================================
begin;

create or replace function lirc_private.person_name(p public."usersData")
returns text
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  mi text;
  given text;
  base text;
begin
  if p is null then
    return null;
  end if;
  if lower(btrim(p.role::text)) = 'guest' then
    return nullif(concat_ws(' ', 'Guest', nullif(btrim(p.surname), '')), '');
  end if;
  mi := nullif(btrim(p.middle_initial), '');
  if mi is not null and right(mi, 1) <> '.' then
    mi := mi || '.';
  end if;
  given := nullif(concat_ws(' ', nullif(btrim(p.first_name), ''), mi), '');
  base := concat_ws(', ', nullif(btrim(p.surname), ''), given);
  return nullif(concat_ws(' ', base, nullif(btrim(p.suffix), '')), '');
end $$;
revoke all on function lirc_private.person_name(public."usersData")
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The attendance station records a time in / time out (unchanged behavior).
-- ---------------------------------------------------------------------------
create or replace function public.lirc_system_attendance(
  p_library_id text,
  p_purpose text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me bigint;
  v_card text;
  v_purpose text;
  u public."usersData"%ROWTYPE;
  v_term public.semesters%ROWTYPE;
  v_visit public.attendance%ROWTYPE;
  v_action text;
begin
  v_me := lirc_private.system_attendance_id();
  if v_me is null then
    raise exception 'Attendance station access required.' using errcode = '42501';
  end if;

  v_card := btrim(coalesce(p_library_id, ''));
  if v_card = '' or length(v_card) > 120 then
    raise exception 'Enter a valid library card.';
  end if;

  select * into u from public."usersData"
  where lower(library_id) = lower(v_card)
  for update;
  if not found then
    raise exception 'Library card % was not found.', v_card;
  end if;

  select * into v_visit from public.attendance
  where user_profile_id = u.id and time_out is null
  order by time_in desc, id desc
  limit 1;

  if found then
    update public.attendance set time_out = now() where id = v_visit.id;
    v_action := 'out';
  else
    select * into v_term from public.semesters where is_active limit 1;
    if not found then
      raise exception 'No active semester. Ask the library staff.';
    end if;
    v_purpose := btrim(coalesce(p_purpose, ''));
    if v_purpose = '' then
      v_purpose := 'Study';
    end if;
    if length(v_purpose) > 250 then
      raise exception 'Keep the purpose under 250 characters.';
    end if;
    begin
      insert into public.attendance (user_profile_id, semester_id, purpose_of_visit)
      values (u.id, v_term.id, v_purpose);
      v_action := 'in';
    exception when unique_violation then
      select * into v_visit from public.attendance
      where user_profile_id = u.id and time_out is null
      order by time_in desc, id desc
      limit 1;
      if not found then
        raise exception 'The visit was just updated. Scan the card again.';
      end if;
      update public.attendance set time_out = now() where id = v_visit.id;
      v_action := 'out';
    end;
  end if;

  return jsonb_build_object(
    'action', v_action,
    'member_name', lirc_private.person_name(u),
    'library_id', u.library_id,
    'role', lower(btrim(u.role::text)),
    'at', now(),
    'purpose', case when v_action = 'in' then v_purpose else null end);
end;
$$;
revoke all on function public.lirc_system_attendance(text, text)
  from public, anon, authenticated;
grant execute on function public.lirc_system_attendance(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- The station's recent-visits display (same names).
-- ---------------------------------------------------------------------------
create or replace function public.lirc_system_attendance_recent()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me bigint;
begin
  v_me := lirc_private.system_attendance_id();
  if v_me is null then
    raise exception 'Attendance station access required.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
        'id', x.id,
        'member_name', x.member_name,
        'library_id', x.library_id,
        'purpose', x.purpose,
        'time_in', x.time_in,
        'time_out', x.time_out,
        'is_open', x.is_open)
        order by x.time_in desc, x.id desc)
    from (
      select a.id,
             coalesce(nullif(btrim(a.guest_name), ''),
                      lirc_private.person_name(u)) as member_name,
             u.library_id,
             a.purpose_of_visit as purpose,
             a.time_in, a.time_out,
             a.time_out is null as is_open
      from public.attendance a
      left join public."usersData" u on u.id = a.user_profile_id
      order by a.time_in desc, a.id desc
      limit 10
    ) x), '[]'::jsonb);
end;
$$;
revoke all on function public.lirc_system_attendance_recent()
  from public, anon, authenticated;
grant execute on function public.lirc_system_attendance_recent() to authenticated;

notify pgrst, 'reload schema';
commit;
