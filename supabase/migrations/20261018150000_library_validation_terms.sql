-- ============================================================================
-- Terminology: "annual enrollment" is called LIBRARY VALIDATION.
--
-- The activity feed reads its sentences from describe_goal_event first (a
-- small wrapper). New branches cover the enrollment-family actions and the
-- direct student_enrollments writes, so the feed and the User logs page say
-- "library validation" instead of "enrollment". Everything else is unchanged.
-- ============================================================================
begin;

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

  -- Library validation (the process formerly called annual enrollment).
  if p_event.action in ('enrollment.request', 'enrollment.review') then
    return case p_event.action
      when 'enrollment.request' then 'Submitted a library validation change request'
      else 'Reviewed a library validation change request'
    end;
  end if;
  if p_event.action = 'enrollment.apply' then
    return format('Applied a library validation change for member #%s',
      coalesce(p_event.entity_id, 0));
  end if;
  if p_event.action like 'student_enrollments.%' then
    return format('%s library validation record #%s',
      case lower(coalesce(p_event.meta ->> 'op', ''))
        when 'insert' then 'Created'
        when 'delete' then 'Removed'
        else 'Changed'
      end,
      coalesce(p_event.entity_id, 0));
  end if;

  return null;
end $$;
revoke all on function lirc_private.describe_goal_event(public.activity_events)
  from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
