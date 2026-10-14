-- ============================================================================
-- The AI dossier gains one more spam signal: the busiest five-minute window
-- (max_actions_in_5_min). A high number means many actions in a very short
-- burst — the clearest sign of number-padding, which the prompt now weighs
-- heavily. Days-worked is context only; the rating is about quality.
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
  where n.nspname = 'public' and p.proname = 'lirc_performance_ai_input';
  if v_def is null then
    raise exception 'public.lirc_performance_ai_input was not found.';
  end if;
  if position('max_actions_in_5_min' in v_def) = 0 then
    v_new := replace(v_def,
      '  v_max_share numeric;',
      E'  v_max_share numeric;\n  v_burst integer;');
    v_new := replace(v_new,
      '  -- a spread sample:',
      E'  -- the busiest five-minute window (spam indicator)\n  select coalesce(max(w.cnt), 0) into v_burst\n    from (\n      select count(*) over (\n               order by e.occurred_at\n               range between current row and interval ''5 minutes'' following) as cnt\n        from public.activity_events e\n       where e.actor_profile_id = p_profile_id\n         and e.occurred_at >= v_from and e.occurred_at < v_to) w;\n\n  -- a spread sample:');
    v_new := replace(v_new,
      '      ''max_single_action_share'', round(v_max_share, 2),',
      E'      ''max_single_action_share'', round(v_max_share, 2),\n      ''max_actions_in_5_min'', v_burst,');
    if position('max_actions_in_5_min' in v_new) = 0 then
      raise exception 'Expected patterns not found in lirc_performance_ai_input.';
    end if;
    execute v_new;
  end if;
end $$;

notify pgrst, 'reload schema';
commit;
