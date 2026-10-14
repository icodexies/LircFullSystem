-- ============================================================================
-- Profile images in the staff screens: the attendance visits list, the
-- member lookup (Users page), the member record, and the admin User
-- performance page all carry the person's avatar_url now.
--
-- Live definitions are patched in place (idempotent) so nothing else moves.
-- ============================================================================
begin;

do $$
declare
  v_def text;
  v_new text;
begin
  -- 0) the shared dimensions view gains the photo (appended column)
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'lirc_private' and table_name = 'profile_dimensions'
      and column_name = 'avatar_url'
  ) then
    execute $view$
create or replace view lirc_private.profile_dimensions as
select u.id,
       u.first_name,
       u.surname,
       u.middle_initial,
       u.library_id,
       u.role,
       u.user_id,
       u.department_id,
       u.program_id,
       u.position_classification_id,
       u.suffix,
       (u.department_id)::text as classification_department,
       dim_department.name as department_label,
       (u.program_id)::text as classification_program,
       dim_program.name as program_label,
       (u.position_classification_id)::text as classification_position,
       dim_position.name as position_label,
       u.avatar_url
from public."usersData" u
  left join public.departments dim_department on dim_department.id = u.department_id
  left join public.programs dim_program on dim_program.id = u.program_id
  left join public.position_classifications dim_position on dim_position.id = u.position_classification_id
$view$;
  end if;

  -- 1) attendance visit rows (lirc_private.filtered_attendance)
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'lirc_private' and p.proname = 'filtered_attendance';
  if v_def is null then
    raise exception 'lirc_private.filtered_attendance was not found.';
  end if;
  if position('avatar_url' in v_def) = 0 then
    v_new := replace(v_def,
      $p$'library_id',u.library_id,$p$,
      $r$'library_id',u.library_id,'avatar_url',u.avatar_url,$r$);
    if position('avatar_url' in v_new) = 0 then
      raise exception 'row pattern not found in filtered_attendance.';
    end if;
    execute v_new;
  end if;

  -- 2) member lookup rows (two branches: card match + name search)
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'lirc_member_lookup';
  if v_def is null then
    raise exception 'public.lirc_member_lookup was not found.';
  end if;
  if position('avatar_url' in v_def) = 0 then
    v_new := replace(v_def,
      $p$u.library_id, u.role, u.surname,$p$,
      $r$u.library_id, u.role, u.surname, u.avatar_url,$r$);
    v_new := replace(v_new,
      $p$'library_id', x.library_id,$p$,
      $r$'library_id', x.library_id, 'avatar_url', x.avatar_url,$r$);
    if position('avatar_url' in v_new) = 0 then
      raise exception 'row pattern not found in lirc_member_lookup.';
    end if;
    execute v_new;
  end if;

  -- 3) one member's record (lirc_member_profile)
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'lirc_member_profile';
  if v_def is null then
    raise exception 'public.lirc_member_profile was not found.';
  end if;
  if position('avatar_url' in v_def) = 0 then
    v_new := replace(v_def,
      $p$'library_id', u.library_id,$p$,
      $r$'library_id', u.library_id, 'avatar_url', u.avatar_url,$r$);
    if position('avatar_url' in v_new) = 0 then
      raise exception 'row pattern not found in lirc_member_profile.';
    end if;
    execute v_new;
  end if;

  -- 4) the admin User performance profile block
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'lirc_personnel_performance';
  if v_def is null then
    raise exception 'public.lirc_personnel_performance was not found.';
  end if;
  if position('avatar_url' in v_def) = 0 then
    v_new := replace(v_def,
      $p$'library_id', u.library_id),$p$,
      $r$'library_id', u.library_id, 'avatar_url', u.avatar_url),$r$);
    if position('avatar_url' in v_new) = 0 then
      raise exception 'profile pattern not found in lirc_personnel_performance.';
    end if;
    execute v_new;
  end if;
end $$;

notify pgrst, 'reload schema';
commit;
