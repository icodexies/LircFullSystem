-- ============================================================================
-- Overdue books block library validation. A student with books still out past
-- their due date cannot be validated: the save is rejected with a warning.
-- Instead the librarian requests admin permission through the same request
-- workflow — it appears in the page's request tabs with the other requests —
-- and approving it saves the validation.
--
--   1. guard_student_enrollment rejects a validating save (any status but
--      unverified) while the student has overdue loans, unless the write
--      comes from the approval workflow (lirc.approved_change is on).
--   2. lirc_request_enrollment_change allows a CURRENT-year request when the
--      student has overdue loans (otherwise the direct save stays the only
--      way), and the admin notification says why.
--
-- Both functions are patched from their live definitions, so nothing else
-- changes.
-- ============================================================================
begin;

-- 1) the enrollment guard ----------------------------------------------------
do $$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'lirc_private' and p.proname = 'guard_student_enrollment';
  if v_def is null then
    raise exception 'guard_student_enrollment was not found.';
  end if;
  if position('overdue book' in v_def) > 0 then
    raise notice 'guard already carries the overdue rule.';
  else
    v_new := replace(v_def,
      $p$declare
  staff bigint;
  student_role text;
begin$p$,
      $r$declare
  staff bigint;
  student_role text;
  v_overdue integer;
begin$r$);
    if position('v_overdue integer' in v_new) = 0 then
      raise exception 'declare pattern not found in guard_student_enrollment.';
    end if;

    v_new := replace(v_new,
      $p$  -- Past school years change only through the approval workflow.
  if coalesce(current_setting('lirc.approved_change', true), '') <> 'on'
     and (select (now() at time zone 'Asia/Manila')::date > ay.ends_on
            from public.academic_years ay where ay.id = NEW.academic_year_id) then
    raise exception 'Past school years need admin approval. Submit a change request instead.';
  end if;$p$,
      $r$  -- Past school years change only through the approval workflow, and a
  -- student with overdue books cannot be validated without admin permission.
  if coalesce(current_setting('lirc.approved_change', true), '') <> 'on' then
    if (select (now() at time zone 'Asia/Manila')::date > ay.ends_on
          from public.academic_years ay where ay.id = NEW.academic_year_id) then
      raise exception 'Past school years need admin approval. Submit a change request instead.';
    end if;
    if NEW.status <> 'unverified' then
      select count(*) into v_overdue
      from public.book_loans l
      where l.user_profile_id = NEW.user_profile_id
        and l.returned_at is null and l.due_at < now();
      if v_overdue > 0 then
        raise exception 'This student has % overdue book(s). Record the returns first, or request admin permission to validate.', v_overdue;
      end if;
    end if;
  end if;$r$);
    if position('overdue book' in v_new) = 0 then
      raise exception 'past-year pattern not found in guard_student_enrollment.';
    end if;
    execute v_new;
  end if;
end $$;

-- 2) the request RPC ---------------------------------------------------------
do $$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'lirc_request_enrollment_change'
    and p.pronargs = 3;
  if v_def is null then
    raise exception 'lirc_request_enrollment_change was not found.';
  end if;
  if position('v_overdue' in v_def) > 0 then
    raise notice 'request RPC already carries the overdue rule.';
  else
    v_new := replace(v_def,
      $p$  v_student text;
  v_year text;
begin$p$,
      $r$  v_student text;
  v_year text;
  v_overdue integer;
begin$r$);
    if position('v_overdue integer' in v_new) = 0 then
      raise exception 'declare pattern not found in lirc_request_enrollment_change.';
    end if;

    v_new := replace(v_new,
      $p$  if not v_is_past then
    raise exception 'This school year is current. Save it directly instead of requesting approval.';
  end if;$p$,
      $r$  if not v_is_past then
    select count(*) into v_overdue
    from public.book_loans l
    where l.user_profile_id = p_profile_id
      and l.returned_at is null and l.due_at < now();
    if v_overdue = 0 then
      raise exception 'This school year is current. Save it directly instead of requesting approval.';
    end if;
  end if;$r$);
    if position('v_overdue = 0' in v_new) = 0 then
      raise exception 'current-year pattern not found in lirc_request_enrollment_change.';
    end if;

    v_new := replace(v_new,
      $p$format('%s — %s: change to %s', v_student, v_year, lirc_private.enrollment_status_label(p_status)),$p$,
      $r$format('%s — %s: change to %s%s', v_student, v_year,
      lirc_private.enrollment_status_label(p_status),
      case when v_is_past then ''
           else format(' (student has %s overdue book(s))', v_overdue) end),$r$);
    if position('student has %s overdue book(s))' in v_new) = 0 then
      raise exception 'notification pattern not found in lirc_request_enrollment_change.';
    end if;
    execute v_new;
  end if;
end $$;

notify pgrst, 'reload schema';
commit;
