-- ============================================================================
-- Inventory: only an admin can start (create) an inventory session.
-- Counting, pausing, resuming and finishing stay open to staff and librarians
-- — once an admin has opened a session they can all work on it.
--
-- Patched on the LIVE definition (pg_get_functiondef) so the activity
-- prologue stays intact. Idempotent.
-- ============================================================================
begin;

do $$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'lirc_inventory_start';
  if v_def is null then
    raise exception 'public.lirc_inventory_start was not found.';
  end if;
  if position('Only an admin can start an inventory session' in v_def) = 0 then
    v_new := replace(v_def,
      '  v_operator := lirc_private.library_operator_id();',
      E'  if not lirc_private.is_admin() then\n    raise exception ''Only an admin can start an inventory session.'' using errcode = ''42501'';\n  end if;\n  v_operator := lirc_private.library_operator_id();');
    if position('Only an admin can start an inventory session' in v_new) = 0 then
      raise exception 'Expected operator check not found in lirc_inventory_start.';
    end if;
    execute v_new;
  end if;
end $$;

notify pgrst, 'reload schema';
commit;
