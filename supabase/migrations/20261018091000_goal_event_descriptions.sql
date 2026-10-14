-- ============================================================================
-- Stage 4b: goal events get real sentences in the activity feed.
--
-- The existing describer is renamed to describe_activity_core and a new
-- describe_activity wrapper answers goal-specific actions first, then falls
-- back to the core for everything else. No behaviour changes for non-goal
-- events.
-- ============================================================================
begin;

alter function lirc_private.describe_activity(public.activity_events)
  rename to describe_activity_core;

create or replace function lirc_private.describe_goal_event(
  p_event public.activity_events)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_goal text;
  v_item text;
  v_units text;
  v_kind text;
  v_role text;
  v_reason text := p_event.reason;
  v_goal_type text;
begin
  -- goal lifecycle --------------------------------------------------------
  if p_event.action in ('goal.create', 'goal.activate', 'goal.pause',
                        'goal.resume', 'goal.complete') then
    select g.name into v_name
    from public.work_goals g where g.id = p_event.entity_id;
    v_name := coalesce(v_name, p_event.meta ->> 'name',
                       'goal #' || coalesce(p_event.entity_id, 0)::text);
    if p_event.action = 'goal.create' then
      v_goal_type := p_event.meta ->> 'goal_type';
      return format('Created goal %s%s', quote_literal(v_name),
        case when v_goal_type is not null
             then ' (' || replace(v_goal_type, '_', ' ') || ')'
             else '' end);
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

  -- scope revisions -------------------------------------------------------
  if p_event.action = 'goal.scope.revise' then
    select g.name into v_goal
    from public.work_goals g where g.id = p_event.entity_id;
    v_kind := p_event.meta ->> 'kind';
    return format('Scope revised on %s: %s — %s item(s)%s',
      quote_literal(coalesce(v_goal, 'goal')),
      coalesce(v_kind, 'change'),
      coalesce(p_event.meta ->> 'excluded',
               p_event.meta ->> 'added', '0'),
      case when v_reason is not null then ' — ' || v_reason else '' end);
  end if;

  -- membership ------------------------------------------------------------
  if p_event.action = 'goal.member.set' then
    select concat_ws(' ', u.surname || ',', u.first_name, u.middle_initial,
                     u.suffix)
      into v_name
    from public."usersData" u where u.id = p_event.entity_id;
    select g.name into v_goal
    from public.work_goals g
    where g.id = coalesce((p_event.meta ->> 'goal_id')::bigint, 0);
    v_role := p_event.meta ->> 'role';
    return format('Set %s as %s on %s',
      coalesce(v_name, 'profile #' || coalesce(p_event.entity_id, 0)::text),
      coalesce(v_role, 'member'), quote_literal(coalesce(v_goal, 'goal')));
  end if;

  -- credit ledger ---------------------------------------------------------
  if p_event.action in ('goal.credit.award', 'goal.credit.reverse') then
    select coalesce(i.snapshot ->> 'accession_number',
                    i.snapshot ->> 'book_name',
                    i.snapshot ->> 'library_id',
                    i.item_type || ' #' || i.item_id)
      into v_item
    from public.goal_items i where i.id = p_event.entity_id;
    v_item := coalesce(v_item, 'item #' || coalesce(p_event.entity_id, 0)::text);
    select g.name into v_goal
    from public.work_goals g
    where g.id = coalesce((p_event.meta ->> 'goal_id')::bigint, 0);
    v_kind := p_event.meta ->> 'kind';
    v_units := p_event.meta ->> 'units';
    if p_event.action = 'goal.credit.award' then
      if v_kind = 'review' then
        return format('Reviewed %s for %s', v_item,
          quote_literal(coalesce(v_goal, 'goal')));
      end if;
      return format('Earned %s credit for %s in %s',
        coalesce(v_units, '1'), v_item,
        quote_literal(coalesce(v_goal, 'goal')));
    end if;
    return format('Credit reversed for %s%s',
      v_item,
      case when v_reason is not null then ' — ' || v_reason else '' end);
  end if;

  -- reviews and verification ---------------------------------------------
  if p_event.action in ('goal.review.accept', 'goal.review.reject') then
    select coalesce(i.snapshot ->> 'book_name',
                    i.snapshot ->> 'accession_number',
                    i.item_type || ' #' || i.item_id)
      into v_item
    from public.goal_items i where i.id = p_event.entity_id;
    v_item := coalesce(v_item, 'item #' || coalesce(p_event.entity_id, 0)::text);
    return format('%s %s%s',
      case p_event.action when 'goal.review.accept' then 'Accepted review for'
                          else 'Rejected review for' end,
      v_item,
      case when v_reason is not null then ' — ' || v_reason else '' end);
  end if;

  if p_event.action = 'goal.item.verify' then
    select coalesce(i.snapshot ->> 'accession_number',
                    i.snapshot ->> 'book_name',
                    i.item_type || ' #' || i.item_id)
      into v_item
    from public.goal_items i where i.id = p_event.entity_id;
    return format('Verified %s without credit%s',
      coalesce(v_item, 'item #' || coalesce(p_event.entity_id, 0)::text),
      case when v_reason is not null then ' — ' || v_reason else '' end);
  end if;

  -- barcode downloads -----------------------------------------------------
  if p_event.action = 'barcode.template.download' then
    select t.name into v_name
    from public.barcode_templates t where t.id = p_event.entity_id;
    return format('Downloaded barcode template %s',
      quote_literal(coalesce(v_name, p_event.meta ->> 'name',
                             '#' || coalesce(p_event.entity_id, 0)::text)));
  end if;

  return null;  -- not a goal event: the core describer handles it
end $$;
revoke all on function lirc_private.describe_goal_event(public.activity_events)
  from public, anon, authenticated;

create or replace function lirc_private.describe_activity(
  p_event public.activity_events)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v text;
begin
  v := lirc_private.describe_goal_event(p_event);
  if v is not null then
    return v;
  end if;
  return lirc_private.describe_activity_core(p_event);
end $$;
revoke all on function lirc_private.describe_activity(public.activity_events)
  from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
