-- ============================================================================
-- Stage 1c: action context prologues for the existing RPCs
--
-- Adds exactly ONE line to each listed function, right after its outer
-- `begin`:
--
--   perform lirc_private.activity_context('<action>', '<primary_table>');
--
-- This names the action, marks the primary table and opens one operation id
-- for the whole call, so the generic capture triggers can group every row a
-- single user action writes (primary row = 'app', automatic side effects =
-- 'auto' with a parent event). No other logic is touched.
--
-- The patch is applied to the LIVE definitions (pg_get_functiondef) so it
-- always matches what is really running. It is idempotent: functions that
-- already call activity_context are skipped.
--
-- Functions already carrying their context (rewritten in Stage 1b):
--   lirc_inventory_scan, lirc_inventory_set_missing
-- ============================================================================
begin;

do $$
declare
  c_map jsonb := jsonb_build_object(
    'lirc_inventory_update_entry',      jsonb_build_array('inventory.entry.update', 'inventory_entries'),
    'lirc_inventory_start',             jsonb_build_array('inventory.start', 'inventory_sessions'),
    'lirc_inventory_pause',             jsonb_build_array('inventory.pause', 'inventory_sessions'),
    'lirc_inventory_resume',            jsonb_build_array('inventory.resume', 'inventory_sessions'),
    'lirc_inventory_finish',            jsonb_build_array('inventory.finish', 'inventory_sessions'),
    'lirc_borrow_book',                 jsonb_build_array('loans.borrow', 'book_loans'),
    'lirc_return_loan',                 jsonb_build_array('loans.return', 'book_loans'),
    'lirc_add_user',                    jsonb_build_array('users.add', 'usersData'),
    'lirc_import_users',                jsonb_build_array('users.import', 'usersData'),
    'lirc_request_member_change',       jsonb_build_array('member_change.request', 'member_change_requests'),
    'lirc_review_member_change',        jsonb_build_array('member_change.review', 'member_change_requests'),
    'lirc_request_enrollment_change',   jsonb_build_array('enrollment.request', 'enrollment_change_requests'),
    'lirc_review_enrollment_change',    jsonb_build_array('enrollment.review', 'enrollment_change_requests'),
    'lirc_add_book',                    jsonb_build_array('catalog.book.add', 'books'),
    'lirc_save_book_copies',            jsonb_build_array('catalog.copies.save', 'book_accession_numbers'),
    'set_active_semester',              jsonb_build_array('semesters.activate', 'semesters'),
    'lirc_barcode_add',                 jsonb_build_array('barcode.add', 'barcode_entries'),
    'lirc_barcode_remove',              jsonb_build_array('barcode.remove', 'barcode_entries'),
    'lirc_barcode_create_template',     jsonb_build_array('barcode.template.create', 'barcode_templates')
  );
  -- optional prologues for write helpers some RPCs are built on
  c_helper_map jsonb := jsonb_build_object(
    'apply_member_change',     jsonb_build_array('member_change.apply', 'usersData'),
    'apply_enrollment_change', jsonb_build_array('enrollment.apply', 'student_enrollments')
  );
  v_fn text;
  v_action text;
  v_table text;
  v_seen text[] := '{}';
  v_def text;
  v_new text;
  v_prologue text;
  v_anchor text;
  v_candidate text;
  v_pos integer;
  v_after integer;
  v_oid oid;
  v_lang text;
  v_any boolean;
begin
  -- 1) public RPC prologues
  for v_fn, v_action, v_table in
    select key, value ->> 0, value ->> 1
    from jsonb_each(c_map)
  loop
    v_any := false;
    for v_oid, v_lang in
      select p.oid, l.lanname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join pg_language l on l.oid = p.prolang
      where n.nspname = 'public' and p.proname = v_fn
    loop
      v_any := true;
      if v_lang <> 'plpgsql' then
        raise exception 'Function % is % — expected plpgsql.', v_fn, v_lang;
      end if;
      v_def := pg_get_functiondef(v_oid);
      if position('lirc_private.activity_context' in v_def) > 0 then
        v_seen := v_seen || v_fn;
        continue;  -- already patched (idempotent)
      end if;

      v_anchor := null;
      foreach v_candidate in array
        array[E'\nbegin\n', E'\nbegin\r\n', E'\nBEGIN\n', E'\nBEGIN\r\n']
      loop
        v_pos := position(v_candidate in v_def);
        if v_pos > 0 then
          v_anchor := v_candidate;
          exit;
        end if;
      end loop;
      if v_anchor is null then
        raise exception 'No outer BEGIN anchor found in %.', v_fn;
      end if;

      v_after := v_pos + length(v_anchor);
      v_prologue :=
        '  perform lirc_private.activity_context(' ||
        quote_literal(v_action) || ', ' || quote_literal(v_table) || ');';
      v_new := left(v_def, v_after - 1) || v_prologue || E'\n' ||
               right(v_def, length(v_def) - v_after + 1);
      execute v_new;
      v_seen := v_seen || v_fn;
    end loop;
    if not v_any then
      raise exception 'Listed function %.% was not found.', 'public', v_fn;
    end if;
  end loop;

  -- 2) helper prologues (guard against double-setting with coalesce inside
  --    activity_context; helpers run inside the caller's operation)
  for v_fn, v_action, v_table in
    select key, value ->> 0, value ->> 1
    from jsonb_each(c_helper_map)
  loop
    v_any := false;
    for v_oid, v_lang in
      select p.oid, l.lanname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join pg_language l on l.oid = p.prolang
      where n.nspname = 'lirc_private' and p.proname = v_fn
    loop
      v_any := true;
      if v_lang <> 'plpgsql' then
        raise exception 'Function lirc_private.% is % — expected plpgsql.', v_fn, v_lang;
      end if;
      v_def := pg_get_functiondef(v_oid);
      if position('lirc_private.activity_context' in v_def) > 0 then
        v_seen := v_seen || ('lirc_private.' || v_fn);
        continue;
      end if;
      v_anchor := null;
      foreach v_candidate in array
        array[E'\nbegin\n', E'\nbegin\r\n', E'\nBEGIN\n', E'\nBEGIN\r\n']
      loop
        v_pos := position(v_candidate in v_def);
        if v_pos > 0 then
          v_anchor := v_candidate;
          exit;
        end if;
      end loop;
      if v_anchor is null then
        raise exception 'No outer BEGIN anchor found in lirc_private.%.', v_fn;
      end if;
      v_after := v_pos + length(v_anchor);
      v_prologue :=
        '  perform lirc_private.activity_context(' ||
        quote_literal(v_action) || ', ' || quote_literal(v_table) || ');';
      v_new := left(v_def, v_after - 1) || v_prologue || E'\n' ||
               right(v_def, length(v_def) - v_after + 1);
      execute v_new;
      v_seen := v_seen || ('lirc_private.' || v_fn);
    end loop;
    if not v_any then
      raise exception 'Listed function lirc_private.% was not found.', v_fn;
    end if;
  end loop;

  -- 3) re-verify: every listed function now names its context
  for v_fn, v_action in
    select key, value ->> 0 from jsonb_each(c_map)
  loop
    if not exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = v_fn
        and position('lirc_private.activity_context' in p.prosrc) > 0
    ) then
      raise exception 'Prologue verification failed for public.%.', v_fn;
    end if;
  end loop;
  raise notice 'activity prologues applied to % functions',
    coalesce(array_length(v_seen, 1), 0);
end $$;

notify pgrst, 'reload schema';
commit;
