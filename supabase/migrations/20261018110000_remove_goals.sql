-- ============================================================================
-- Remove the goal system entirely (decision 2026-10-14).
--
--   * inventory scan / missing functions are restored to their pre-credit
--     bodies (credit helpers removed with the goal system)
--   * historical goal events stay readable: the describer for them is
--     rewritten to use only the event's own meta (no goal tables)
--   * every goal table, RPC and helper is dropped
--
-- The append-only activity log itself (activity_events, security_events,
-- read RPCs) is untouched — it is the history, not the goal system.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. Restore the inventory functions without goal credit
-- ---------------------------------------------------------------------------
create or replace function public.lirc_inventory_scan(
  p_session_id bigint,
  p_accession text,
  p_condition text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operator bigint;
  v_accession text;
  v_condition text;
  v_status text;
  v_accession_id bigint;
  v_entry_id bigint;
  v_existing public.inventory_entries%ROWTYPE;
  v_replaced boolean := false;
begin
  perform lirc_private.activity_context('inventory.scan', 'inventory_entries');
  v_operator := lirc_private.library_operator_id();
  if v_operator is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;

  select s.status into v_status
  from public.inventory_sessions s
  where s.id = p_session_id
  for update;
  if not found then
    raise exception 'Inventory not found.';
  end if;
  if v_status = 'paused' then
    raise exception 'This inventory is paused. Resume it first.';
  end if;
  if v_status <> 'open' then
    raise exception 'This inventory was already finished. Open the history to review it, or start a new inventory.';
  end if;

  v_accession := btrim(coalesce(p_accession, ''));
  if v_accession ~ '^\*.*\*$' and char_length(v_accession) > 2 then
    v_accession := substr(v_accession, 2, char_length(v_accession) - 2);
  end if;
  if v_accession = '' or char_length(v_accession) > 120 then
    raise exception 'Scan or type an accession number.';
  end if;

  v_condition := btrim(coalesce(p_condition, ''));
  if v_condition not in ('Good', 'Damaged') then
    raise exception 'Choose Good Condition or Damaged first.';
  end if;

  select a.id into v_accession_id
  from public.book_accession_numbers a
  where lower(a.accession_number) = lower(v_accession)
  order by a.id
  limit 1;
  if v_accession_id is null then
    return jsonb_build_object('result', 'not_found');
  end if;

  select * into v_existing
  from public.inventory_entries e
  where e.session_id = p_session_id and e.accession_id = v_accession_id
    and e.voided_at is null;

  if found then
    if v_existing.outcome = 'Found' then
      -- Duplicate attempt: recorded with zero state change.
      perform lirc_private.record_activity(
        p_action => 'inventory.scan.duplicate',
        p_entity_type => 'inventory_entries',
        p_entity_id => v_existing.id,
        p_source => 'app',
        p_meta => jsonb_build_object('accession_number', v_accession));
      return jsonb_build_object(
        'result', 'already',
        'entry', lirc_private.inventory_entry_json(v_existing.id));
    end if;
    -- The copy was marked missing earlier; finding it voids that record and
    -- writes a fresh Found row. History keeps both rows.
    update public.inventory_entries
       set voided_at = now(),
           voided_by = v_operator,
           voided_reason = 'Found again on re-scan'
     where id = v_existing.id;
    insert into public.inventory_entries
      (session_id, accession_id, outcome, condition, recorded_by)
    values
      (p_session_id, v_accession_id, 'Found', v_condition, v_operator)
    returning id into v_entry_id;
    v_replaced := true;
  else
    insert into public.inventory_entries
      (session_id, accession_id, outcome, condition, recorded_by)
    values
      (p_session_id, v_accession_id, 'Found', v_condition, v_operator)
    returning id into v_entry_id;
  end if;

  perform lirc_private.refresh_copy_condition(v_accession_id);

  return jsonb_build_object(
    'result', 'saved',
    'replaced_missing', v_replaced,
    'entry', lirc_private.inventory_entry_json(v_entry_id),
    'counts', lirc_private.inventory_counts(p_session_id));
exception when unique_violation then
  -- Another station saved this copy first: behave like "already scanned".
  select e.id into v_entry_id
  from public.inventory_entries e
  where e.session_id = p_session_id and e.accession_id = v_accession_id
    and e.voided_at is null;
  if v_entry_id is not null then
    perform lirc_private.record_activity(
      p_action => 'inventory.scan.duplicate',
      p_entity_type => 'inventory_entries',
      p_entity_id => v_entry_id,
      p_source => 'app',
      p_meta => jsonb_build_object('accession_number', v_accession));
  end if;
  return jsonb_build_object(
    'result', 'already',
    'entry', lirc_private.inventory_entry_json(v_entry_id));
end $$;

create or replace function public.lirc_inventory_set_missing(
  p_session_id bigint,
  p_accession_id bigint,
  p_missing boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operator bigint;
  v_status text;
  v_entry_id bigint;
  v_had_entry boolean;
  e public.inventory_entries%ROWTYPE;
begin
  v_operator := lirc_private.library_operator_id();
  if v_operator is null then
    raise exception 'Library operator access required.' using errcode = '42501';
  end if;
  select s.status into v_status
  from public.inventory_sessions s
  where s.id = p_session_id
  for update;
  if not found then
    raise exception 'Inventory not found.';
  end if;
  if v_status = 'paused' then
    raise exception 'This inventory is paused. Resume it first.';
  end if;
  if v_status <> 'open' then
    raise exception 'This inventory is already finished. Start a new one to change copies.';
  end if;
  if not exists (select 1 from public.book_accession_numbers a where a.id = p_accession_id) then
    raise exception 'Copy not found.';
  end if;

  select * into e
  from public.inventory_entries x
  where x.session_id = p_session_id and x.accession_id = p_accession_id
    and x.voided_at is null;
  v_had_entry := found;  -- captured before any PERFORM resets FOUND

  if p_missing then
    perform lirc_private.activity_context(
      'inventory.missing.add', 'inventory_entries');
    if v_had_entry then
      if e.outcome = 'Missing' then
        perform lirc_private.record_activity(
          p_action => 'inventory.missing.duplicate',
          p_entity_type => 'inventory_entries',
          p_entity_id => e.id,
          p_source => 'app',
          p_meta => jsonb_build_object('accession_id', p_accession_id));
        return jsonb_build_object(
          'entry', lirc_private.inventory_entry_json(e.id),
          'counts', lirc_private.inventory_counts(p_session_id));
      end if;
      raise exception 'This copy is already scanned in this inventory.';
    end if;
    if exists (
      select 1 from public.book_loans l
      where l.accession_id = p_accession_id and l.returned_at is null
    ) then
      raise exception 'This copy is on loan. It cannot be marked missing.';
    end if;
    insert into public.inventory_entries
      (session_id, accession_id, outcome, condition, recorded_by)
    values
      (p_session_id, p_accession_id, 'Missing', null, v_operator)
    returning id into v_entry_id;
    perform lirc_private.refresh_copy_condition(p_accession_id);
    return jsonb_build_object(
      'entry', lirc_private.inventory_entry_json(v_entry_id),
      'counts', lirc_private.inventory_counts(p_session_id));
  end if;

  if not v_had_entry or e.outcome <> 'Missing' then
    raise exception 'This copy is not marked missing.';
  end if;
  perform lirc_private.activity_context(
    'inventory.missing.undo', 'inventory_entries');
  update public.inventory_entries
     set voided_at = now(),
         voided_by = v_operator,
         voided_reason = 'Missing mark undone'
   where id = e.id;
  perform lirc_private.refresh_copy_condition(p_accession_id);
  return jsonb_build_object(
    'removed', true,
    'voided', true,
    'counts', lirc_private.inventory_counts(p_session_id));
end $$;

-- ---------------------------------------------------------------------------
-- 2. Historical goal events stay readable (meta-only describer)
-- ---------------------------------------------------------------------------
create or replace function lirc_private.describe_goal_event(
  p_event public.activity_events)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_name text := p_event.meta ->> 'name';
  v_goal_type text;
  v_reason text := p_event.reason;
begin
  if p_event.action in ('goal.create', 'goal.activate', 'goal.pause',
                        'goal.resume', 'goal.complete') then
    v_name := coalesce(v_name, 'goal #' || coalesce(p_event.entity_id, 0)::text);
    if p_event.action = 'goal.create' then
      v_goal_type := p_event.meta ->> 'goal_type';
      return format('Created goal %s%s', quote_literal(v_name),
        case when v_goal_type is not null
             then ' (' || replace(v_goal_type, '_', ' ') || ')' else '' end);
    elsif p_event.action = 'goal.activate' then
      return format('Activated goal %s — %s items frozen in scope',
        quote_literal(v_name),
        to_char(coalesce((p_event.meta ->> 'baseline_count')::numeric, 0),
                'FM999,999,999'));
    elsif p_event.action = 'goal.pause' then
      return format('Paused goal %s — no new credit until it resumes',
        quote_literal(v_name));
    elsif p_event.action = 'goal.resume' then
      return format('Resumed goal %s', quote_literal(v_name));
    else
      return format('Completed goal %s — outstanding items stay open',
        quote_literal(v_name));
    end if;
  end if;
  if p_event.action = 'goal.scope.revise' then
    return format('Scope revised on %s: %s — %s item(s)%s',
      quote_literal(coalesce(v_name, 'goal')),
      coalesce(p_event.meta ->> 'kind', 'change'),
      coalesce(p_event.meta ->> 'excluded', p_event.meta ->> 'added', '0'),
      case when v_reason is not null then ' — ' || v_reason else '' end);
  end if;
  if p_event.action = 'goal.member.set' then
    return format('Set member #%s as %s%s',
      coalesce(p_event.meta ->> 'profile_id',
               coalesce(p_event.entity_id, 0)::text),
      coalesce(p_event.meta ->> 'role', 'member'),
      case when v_reason is not null then ' — ' || v_reason else '' end);
  end if;
  if p_event.action in ('goal.credit.award', 'goal.credit.reverse') then
    if p_event.action = 'goal.credit.award'
       and (p_event.meta ->> 'kind') = 'review' then
      return 'Recorded a review for a goal item';
    end if;
    return format('%s for a goal item%s',
      case p_event.action when 'goal.credit.award' then 'Earned credit'
                          else 'Credit reversed' end,
      case when v_reason is not null then ' — ' || v_reason else '' end);
  end if;
  if p_event.action in ('goal.review.accept', 'goal.review.reject') then
    return format('%s a goal item%s',
      case p_event.action when 'goal.review.accept' then 'Accepted review for'
                          else 'Rejected review for' end,
      case when v_reason is not null then ' — ' || v_reason else '' end);
  end if;
  if p_event.action = 'goal.item.verify' then
    return format('Verified a goal item without credit%s',
      case when v_reason is not null then ' — ' || v_reason else '' end);
  end if;
  if p_event.action = 'barcode.template.download' then
    select t.name into v_name
    from public.barcode_templates t where t.id = p_event.entity_id;
    return format('Downloaded barcode template %s',
      quote_literal(coalesce(v_name, p_event.meta ->> 'name',
                             '#' || coalesce(p_event.entity_id, 0)::text)));
  end if;
  return null;
end $$;
revoke all on function lirc_private.describe_goal_event(public.activity_events)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Drop the goal system (constraint, tables, RPCs, helpers)
-- ---------------------------------------------------------------------------
alter table public.activity_events
  drop constraint if exists activity_events_goal_item_fkey;

drop table if exists public.goal_contributions;
drop table if exists public.goal_scope_revisions;
drop table if exists public.goal_members;
drop table if exists public.goal_items;
drop table if exists public.work_goals;

drop function if exists public.lirc_goal_create(text, text, text, jsonb, jsonb);
drop function if exists public.lirc_goal_activate(bigint);
drop function if exists public.lirc_goal_set_member(bigint, bigint, text);
drop function if exists public.lirc_goal_revise_scope(bigint, text, jsonb, text);
drop function if exists public.lirc_goal_pause(bigint);
drop function if exists public.lirc_goal_resume(bigint);
drop function if exists public.lirc_goal_complete(bigint);
drop function if exists public.lirc_goal_review_item(bigint, boolean, text);
drop function if exists public.lirc_goal_list(boolean);
drop function if exists public.lirc_goal_get(bigint);
drop function if exists public.lirc_goal_my_contribution(bigint, integer, integer, text);
drop function if exists public.lirc_goal_review_queue(integer, integer);
drop function if exists public.lirc_goal_verify_item(bigint, text);
drop function if exists public.lirc_goal_reconcile(bigint);

drop function if exists lirc_private.inventory_credit_scan(bigint, bigint, bigint, boolean);
drop function if exists lirc_private.inventory_credit_missing(bigint, bigint, bigint);
drop function if exists lirc_private.inventory_credit_undo(bigint, bigint);
drop function if exists lirc_private.goal_award(bigint, bigint, text, numeric, text);
drop function if exists lirc_private.goal_reverse_award(bigint, text);
drop function if exists lirc_private.goal_mark_verified(bigint, text);
drop function if exists lirc_private.goal_maybe_complete(bigint);
drop function if exists lirc_private.goal_reviews_met(bigint);
drop function if exists lirc_private.goal_review_count(bigint);
drop function if exists lirc_private.goal_net_work_units(bigint);
drop function if exists lirc_private.is_goal_member(bigint, text[]);
drop function if exists lirc_private.goal_summary_json(bigint);
drop function if exists lirc_private.goal_item_snapshot(text, bigint);
drop function if exists lirc_private.goal_contribution_guard();
drop function if exists lirc_private.goal_item_guard();

notify pgrst, 'reload schema';
commit;
