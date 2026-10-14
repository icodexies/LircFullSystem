-- ============================================================================
-- Status labels: the UI shows "Validated" instead of the raw database value
-- "enrolled" (same idea for the other validation statuses). This migration
-- does the database side:
--
-- 1. lirc_private.enrollment_status_label(text) — one shared word map.
-- 2. Borrow preview / record-loan reasons use plain words + the label.
-- 3. Validation-change notifications use the label.
--
-- Applied to the LIVE definitions (pg_get_functiondef) with exact string
-- replacement, so the activity prologue lines stay intact. Idempotent.
-- ============================================================================
begin;

create or replace function lirc_private.enrollment_status_label(p_status text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'enrolled' then 'Validated'
    when 'unverified' then 'Not verified'
    when 'leave_of_absence' then 'On leave'
    when 'withdrawn' then 'Withdrawn'
    when 'graduated' then 'Graduated'
    else coalesce(replace(p_status, '_', ' '), 'Not verified')
  end;
$$;
revoke all on function lirc_private.enrollment_status_label(text)
  from public, anon, authenticated;

do $$
declare
  v_def text;
  v_new text;
  v_fn text;
begin
  -- 1) borrow preview + record loan: plain words, labeled status detail
  foreach v_fn in array array['lirc_borrow_preview', 'lirc_borrow_book'] loop
    select pg_get_functiondef(p.oid) into v_def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = v_fn;
    if v_def is null then
      raise exception 'public.% was not found.', v_fn;
    end if;
    if position('enrollment_status_label' in v_def) > 0 then
      continue;  -- already updated
    end if;
    v_new := replace(v_def,
      'Student has no annual validation for the current school year.',
      'Student has no library validation for the current school year.');
    v_new := replace(v_new,
      $p$'Student is not validated as enrolled (status: %).', e.status$p$,
      $r$'Student''s library validation is not complete (currently: %s).', lirc_private.enrollment_status_label(e.status)$r$);
    if position('library validation for the current school year' in v_new) = 0
       or position('enrollment_status_label' in v_new) = 0 then
      raise exception 'Expected borrow reasons not found in public.%.', v_fn;
    end if;
    execute v_new;
  end loop;

  -- 2) validation-change notifications: labeled status words
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'lirc_request_enrollment_change';
  if v_def is null then
    raise exception 'public.lirc_request_enrollment_change was not found.';
  end if;
  if position('enrollment_status_label' in v_def) = 0 then
    v_new := replace(v_def,
      $p$change to %s', v_student, v_year, replace(p_status, '_', ' ')$p$,
      $r$change to %s', v_student, v_year, lirc_private.enrollment_status_label(p_status)$r$);
    if position('enrollment_status_label' in v_new) = 0 then
      raise exception 'Expected request message not found in lirc_request_enrollment_change.';
    end if;
    execute v_new;
  end if;

  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'lirc_review_enrollment_change';
  if v_def is null then
    raise exception 'public.lirc_review_enrollment_change was not found.';
  end if;
  if position('enrollment_status_label' in v_def) = 0 then
    v_new := replace(v_def,
      $p$replace(r.requested_status, '_', ' ')$p$,
      $r$lirc_private.enrollment_status_label(r.requested_status)$r$);
    if position('enrollment_status_label' in v_new) = 0 then
      raise exception 'Expected review message not found in lirc_review_enrollment_change.';
    end if;
    execute v_new;
  end if;

  -- 3) verify: no raw status wording left in the four functions
  for v_fn, v_def in
    select p.proname, p.prosrc
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('lirc_borrow_preview', 'lirc_borrow_book',
                        'lirc_request_enrollment_change',
                        'lirc_review_enrollment_change')
  loop
    if position('not validated as enrolled' in v_def) > 0
       or position('annual validation for the current school year' in v_def) > 0 then
      raise exception 'Raw status wording still present in public.%.', v_fn;
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;
