-- ============================================================================
-- Stage 3: inventory pilot wiring (credit rules for the open session)
--
-- Credit rules enforced here (server-side, same transaction as the scan):
--   * first Found scan per copy per goal  -> 1 unit to the scanner
--   * duplicate scans / retries           -> 0 (attempt events only, Stage 1)
--   * missing confirmation                -> 1 unit to the confirmer
--   * missing undo                        -> reversal, item reopens
--   * missing -> found on re-scan         -> reversal of the missing credit
--                                            + 1 unit to the scanner
--   * corrections (update_entry)          -> 0
--   * automated side effects              -> 0
--   * paused/absent goals                 -> no credit, inventory keeps working
--   * an item not in any goal scope       -> no credit
--
-- Physical-check and reconciliation progress are separate server aggregates
-- (added to goal_summary_json for inventory goals):
--   physical-check  = items with any live scan/missing confirmation / baseline
--   reconciliation  = resolved to found, confirmed missing, or human-verified
--                     on loan / baseline
--
-- Finishing a session stays an operation event only: it never completes the
-- goal and never closes outstanding items.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. Credit helpers (private)
-- ---------------------------------------------------------------------------
create or replace function lirc_private.inventory_credit_scan(
  p_session_id bigint,
  p_accession_id bigint,
  p_actor bigint,
  p_replaced_missing boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g record;
  v_item public.goal_items%ROWTYPE;
  v_award record;
begin
  for g in
    select w.id
    from public.work_goals w
    where w.goal_type = 'inventory'
      and w.status = 'active'
      and nullif(w.scope ->> 'session_id', '')::bigint = p_session_id
  loop
    select * into v_item
    from public.goal_items i
    where i.goal_id = g.id
      and i.item_type = 'accession_copy'
      and i.item_id = p_accession_id;
    if not found or v_item.state = 'excluded' then
      continue;
    end if;

    if p_replaced_missing then
      -- found again: the missing credit is reversed, the scanner earns the unit
      for v_award in
        select c.id
        from public.goal_contributions c
        where c.goal_item_id = v_item.id
          and c.kind = 'work'
          and c.status = 'awarded'
      loop
        perform lirc_private.goal_reverse_award(
          v_award.id, 'Missing mark replaced by a re-scan');
      end loop;
    end if;

    if lirc_private.goal_net_work_units(v_item.id) = 0 then
      perform lirc_private.goal_award(
        v_item.id, p_actor, 'work', 1, 'First scan in session');
    end if;
  end loop;
end $$;
revoke all on function lirc_private.inventory_credit_scan(bigint, bigint, bigint, boolean)
  from public, anon, authenticated;

create or replace function lirc_private.inventory_credit_missing(
  p_session_id bigint,
  p_accession_id bigint,
  p_actor bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g record;
  v_item public.goal_items%ROWTYPE;
begin
  for g in
    select w.id
    from public.work_goals w
    where w.goal_type = 'inventory'
      and w.status = 'active'
      and nullif(w.scope ->> 'session_id', '')::bigint = p_session_id
  loop
    select * into v_item
    from public.goal_items i
    where i.goal_id = g.id
      and i.item_type = 'accession_copy'
      and i.item_id = p_accession_id;
    if not found or v_item.state = 'excluded' then
      continue;
    end if;
    if lirc_private.goal_net_work_units(v_item.id) = 0 then
      perform lirc_private.goal_award(
        v_item.id, p_actor, 'work', 1, 'Missing confirmation');
    end if;
  end loop;
end $$;
revoke all on function lirc_private.inventory_credit_missing(bigint, bigint, bigint)
  from public, anon, authenticated;

create or replace function lirc_private.inventory_credit_undo(
  p_session_id bigint,
  p_accession_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g record;
  v_item public.goal_items%ROWTYPE;
  v_award record;
begin
  for g in
    select w.id
    from public.work_goals w
    where w.goal_type = 'inventory'
      and nullif(w.scope ->> 'session_id', '')::bigint = p_session_id
      and w.status in ('active', 'paused')
  loop
    select * into v_item
    from public.goal_items i
    where i.goal_id = g.id
      and i.item_type = 'accession_copy'
      and i.item_id = p_accession_id;
    if not found or v_item.state = 'excluded' then
      continue;
    end if;
    for v_award in
      select c.id
      from public.goal_contributions c
      where c.goal_item_id = v_item.id
        and c.kind = 'work'
        and c.status = 'awarded'
    loop
      perform lirc_private.goal_reverse_award(
        v_award.id, 'Missing mark undone');
    end loop;
  end loop;
end $$;
revoke all on function lirc_private.inventory_credit_undo(bigint, bigint)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Goal summary gains the two separate inventory progress measures
-- ---------------------------------------------------------------------------
create or replace function lirc_private.goal_summary_json(p_goal_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_baseline integer;
  v_goal_type text;
  v_session bigint;
  v_completed integer;
  v_verified integer;
  v_open integer;
  v_excluded integer;
  v_team_units numeric;
  v_physical integer;
  v_reconciled integer;
begin
  select coalesce(g.baseline_count, 0), g.goal_type,
         nullif(g.scope ->> 'session_id', '')::bigint
    into v_baseline, v_goal_type, v_session
  from public.work_goals g where g.id = p_goal_id;
  select count(*) filter (where i.state = 'completed'),
         count(*) filter (where i.state = 'verified'),
         count(*) filter (where i.state = 'open'),
         count(*) filter (where i.state = 'excluded')
    into v_completed, v_verified, v_open, v_excluded
  from public.goal_items i where i.goal_id = p_goal_id;
  select coalesce(sum(c.units), 0) into v_team_units
  from public.goal_contributions c
  where c.goal_id = p_goal_id and c.kind = 'work' and c.status = 'awarded';

  if v_goal_type = 'inventory' and v_session is not null then
    select count(*) into v_physical
    from public.goal_items i
    where i.goal_id = p_goal_id
      and i.state <> 'excluded'
      and exists (
        select 1 from public.inventory_entries e
        where e.session_id = v_session
          and e.accession_id = i.item_id
          and e.voided_at is null);
    select count(*) into v_reconciled
    from public.goal_items i
    where i.goal_id = p_goal_id
      and i.state <> 'excluded'
      and (i.state = 'verified'
        or exists (
          select 1 from public.inventory_entries e
          where e.session_id = v_session
            and e.accession_id = i.item_id
            and e.voided_at is null
            and (e.outcome = 'Missing'
              or (e.outcome = 'Found'
                  and e.condition in ('Good', 'Damaged')))));
  end if;

  return jsonb_build_object(
    'baseline_count', v_baseline,
    'completed', v_completed,
    'verified', v_verified,
    'open', v_open,
    'excluded', v_excluded,
    'team_units', v_team_units,
    'team_progress_pct',
      case when v_baseline > 0
        then round(v_completed::numeric * 100 / v_baseline, 1)
        else null end,
    'physical_check', v_physical,
    'physical_check_pct',
      case when v_baseline > 0 and v_physical is not null
        then round(v_physical::numeric * 100 / v_baseline, 1)
        else null end,
    'reconciled', v_reconciled,
    'reconciliation_pct',
      case when v_baseline > 0 and v_reconciled is not null
        then round(v_reconciled::numeric * 100 / v_baseline, 1)
        else null end);
end $$;
revoke all on function lirc_private.goal_summary_json(bigint)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Scan: credit the first Found (and the missing -> found chain)
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
      -- Duplicate attempt: recorded with zero state change and zero credit.
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

  -- credit: first Found, or reversal + new unit after a missing mark
  perform lirc_private.inventory_credit_scan(
    p_session_id, v_accession_id, v_operator, v_replaced);

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

-- ---------------------------------------------------------------------------
-- 4. Missing: credit the confirmation; undo reverses it
-- ---------------------------------------------------------------------------
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
    -- credit: the confirmed-missing outcome (1 unit to the confirmer)
    perform lirc_private.inventory_credit_missing(
      p_session_id, p_accession_id, v_operator);
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
  -- undo: the missing credit is reversed and the item reopens
  perform lirc_private.inventory_credit_undo(p_session_id, p_accession_id);
  return jsonb_build_object(
    'removed', true,
    'voided', true,
    'counts', lirc_private.inventory_counts(p_session_id));
end $$;

-- ---------------------------------------------------------------------------
-- 5. Explicit human verification (on-loan copies: never automatic credit)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_goal_verify_item(
  p_goal_item_id bigint,
  p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.goal_items%ROWTYPE;
  g public.work_goals%ROWTYPE;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not (lirc_private.can_edit_catalog() or lirc_private.is_admin()) then
    raise exception 'Librarian or admin access required.' using errcode = '42501';
  end if;
  select * into i from public.goal_items where id = p_goal_item_id for update;
  if not found then
    raise exception 'Goal item not found.';
  end if;
  select * into g from public.work_goals where id = i.goal_id;
  if g.status <> 'active' then
    raise exception 'This goal is % — verification needs it active.', g.status;
  end if;
  if i.state <> 'open' then
    raise exception 'Only an open item can be verified (state: %).', i.state;
  end if;
  if v_reason is null then
    raise exception 'Give a reason for the verification.';
  end if;
  perform lirc_private.activity_context('goal.item.verify', 'goal_items');
  perform lirc_private.goal_mark_verified(p_goal_item_id, v_reason);
  return jsonb_build_object(
    'state', 'verified',
    'summary', lirc_private.goal_summary_json(g.id));
end $$;
revoke all on function public.lirc_goal_verify_item(bigint, text)
  from public, anon;
grant execute on function public.lirc_goal_verify_item(bigint, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Barcode template downloads become visible in history (admin only)
-- ---------------------------------------------------------------------------
create or replace function public.lirc_barcode_template_downloaded(
  p_template_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  if not lirc_private.is_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  select t.name into v_name
  from public.barcode_templates t where t.id = p_template_id;
  if v_name is null then
    raise exception 'Template not found.';
  end if;
  perform lirc_private.activity_context(
    'barcode.template.download', 'barcode_templates');
  perform lirc_private.record_activity(
    p_action => 'barcode.template.download',
    p_entity_type => 'barcode_templates',
    p_entity_id => p_template_id,
    p_source => 'app',
    p_meta => jsonb_build_object('name', v_name));
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.lirc_barcode_template_downloaded(bigint)
  from public, anon;
grant execute on function public.lirc_barcode_template_downloaded(bigint)
  to authenticated;

notify pgrst, 'reload schema';
commit;
