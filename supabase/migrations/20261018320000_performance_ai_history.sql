-- ============================================================================
-- The AI dossier gains the person's own history: their previous monthly
-- ratings (month, score, level, headline and the key numbers) before the
-- month being judged. The prompt uses it as the standard — did this month do
-- more or less than their usual, improve or decline, get more efficient or
-- thinner. Regenerating a month never feeds itself (history is strictly
-- before the target month).
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
  if position('v_history' in v_def) = 0 then
    v_new := replace(v_def,
      '  v_events jsonb;',
      E'  v_events jsonb;\n  v_history jsonb;');
    v_new := replace(v_new,
      '  return jsonb_build_object(',
      E'  -- the person''s own standard: previous months, newest first\n  select coalesce(jsonb_agg(jsonb_build_object(\n           ''month'', to_char(h.period_month, ''YYYY-MM''),\n           ''score'', h.rating_score,\n           ''label'', h.rating_label,\n           ''headline'', h.headline,\n           ''actions'', h.summary #>> ''{stats,actions}'',\n           ''active_days'', h.summary #>> ''{stats,active_days}'',\n           ''distinct_action_types'', h.summary #>> ''{signals,distinct_action_types}'',\n           ''max_single_action_share'', h.summary #>> ''{signals,max_single_action_share}'')\n         order by h.period_month desc), ''[]''::jsonb)\n    into v_history\n    from (\n      select * from public.performance_reports r\n       where r.user_profile_id = p_profile_id\n         and r.period_month < v_start\n       order by r.period_month desc\n       limit 6) h;\n\n  return jsonb_build_object(');
    v_new := replace(v_new,
      '    ''events'', v_events);',
      E'    ''events'', v_events,\n    ''history'', v_history);');
    if position('''history'', v_history' in v_new) = 0 then
      raise exception 'Expected patterns not found in lirc_performance_ai_input.';
    end if;
    execute v_new;
  end if;
end $$;

notify pgrst, 'reload schema';
commit;
