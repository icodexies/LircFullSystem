-- ============================================================================
-- Stage 1f: activity read RPCs (server-built descriptions, keyset pagination)
--
--   lirc_activity_feed        — own history for everyone; all history admins
--   lirc_activity_trace       — every event of one operation (admin; own rows
--                               for non-admins)
--   lirc_activity_for_entity  — events for one record (same scoping)
--
-- Descriptions are concrete sentences built here in the database, never
-- "record updated". Every row also carries its entity reference and raw
-- changes so the UI can link and expand.
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- Shared server-side describer
-- ---------------------------------------------------------------------------
create or replace function lirc_private.describe_activity(
  p_event public.activity_events)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_acc text;
  v_book text;
  v_session text;
  v_condition text;
  v_member text;
  v_card text;
  v_role text;
  v_due text;
  v_name text;
  v_from text;
  v_to text;
  v_reason text := p_event.reason;
begin
  begin
    if p_event.action in ('inventory.scan', 'inventory.scan.duplicate') then
      select a.accession_number, s.name, e.condition
        into v_acc, v_session, v_condition
      from public.inventory_entries e
      join public.book_accession_numbers a on a.id = e.accession_id
      join public.inventory_sessions s on s.id = e.session_id
      where e.id = p_event.entity_id;
      if p_event.action = 'inventory.scan' then
        if v_acc is not null then
          return format('Scanned accession %s (%s) in %s',
            v_acc, coalesce(v_condition, 'condition not set'),
            quote_literal(coalesce(v_session, 'inventory')));
        end if;
      else
        return format('Tried to scan accession %s again in %s — already recorded',
          coalesce(v_acc, p_event.meta ->> 'accession_number',
                   '#' || coalesce(p_event.entity_id, 0)::text),
          quote_literal(coalesce(v_session, 'inventory')));
      end if;
    end if;

    if p_event.action in ('inventory.missing.add', 'inventory.missing.undo',
                          'inventory.missing.duplicate') then
      select a.accession_number, s.name
        into v_acc, v_session
      from public.inventory_entries e
      join public.book_accession_numbers a on a.id = e.accession_id
      join public.inventory_sessions s on s.id = e.session_id
      where e.id = p_event.entity_id;
      if p_event.action = 'inventory.missing.add' then
        return format('Marked accession %s missing in %s',
          coalesce(v_acc, '#' || coalesce(p_event.entity_id, 0)::text),
          quote_literal(coalesce(v_session, 'inventory')));
      elsif p_event.action = 'inventory.missing.undo' then
        return format('Undid the missing mark for accession %s in %s',
          coalesce(v_acc, '#' || coalesce(p_event.entity_id, 0)::text),
          quote_literal(coalesce(v_session, 'inventory')));
      else
        return format('Confirmed accession %s missing again in %s — already recorded',
          coalesce(v_acc, '#' || coalesce(p_event.entity_id, 0)::text),
          quote_literal(coalesce(v_session, 'inventory')));
      end if;
    end if;

    if p_event.action = 'inventory.entry.update' then
      select a.accession_number, s.name
        into v_acc, v_session
      from public.inventory_entries e
      join public.book_accession_numbers a on a.id = e.accession_id
      join public.inventory_sessions s on s.id = e.session_id
      where e.id = p_event.entity_id;
      v_from := p_event.changes -> 'condition' ->> 'from';
      v_to := p_event.changes -> 'condition' ->> 'to';
      return format('Changed condition of accession %s from %s to %s in %s',
        coalesce(v_acc, '#' || coalesce(p_event.entity_id, 0)::text),
        coalesce(v_from, 'not set'), coalesce(v_to, 'not set'),
        quote_literal(coalesce(v_session, 'inventory')));
    end if;

    if p_event.action in ('inventory.start', 'inventory.pause',
                          'inventory.resume', 'inventory.finish') then
      select s.name into v_session
      from public.inventory_sessions s
      where s.id = p_event.entity_id;
      return case p_event.action
        when 'inventory.start' then
          format('Started inventory %s', quote_literal(coalesce(v_session, '#' || p_event.entity_id::text)))
        when 'inventory.pause' then
          format('Paused inventory %s', quote_literal(coalesce(v_session, '#' || p_event.entity_id::text)))
        when 'inventory.resume' then
          format('Resumed inventory %s', quote_literal(coalesce(v_session, '#' || p_event.entity_id::text)))
        else
          format('Finished inventory %s', quote_literal(coalesce(v_session, '#' || p_event.entity_id::text)))
      end;
    end if;

    if p_event.action in ('loans.borrow', 'loans.return') then
      select b.book_name, a.accession_number,
             concat_ws(' ', u.first_name, u.middle_initial, u.surname, u.suffix),
             u.library_id,
             to_char(l.due_at at time zone 'Asia/Manila', 'Mon FMDD, YYYY FMHH12:MI AM')
        into v_book, v_acc, v_member, v_card, v_due
      from public.book_loans l
      join public.book_accession_numbers a on a.id = l.accession_id
      join public.books b on b.id = a.book_id
      join public."usersData" u on u.id = l.user_profile_id
      where l.id = p_event.entity_id;
      if p_event.action = 'loans.borrow' then
        return format('Recorded loan: %s (%s) to %s (%s), due %s',
          coalesce(v_book, 'book #' || coalesce(p_event.entity_id, 0)::text),
          coalesce(v_acc, '—'), coalesce(v_member, 'member'),
          coalesce(v_card, '—'), coalesce(v_due, 'not set'));
      end if;
      return format('Returned %s (%s) for %s (%s)',
        coalesce(v_book, 'book #' || coalesce(p_event.entity_id, 0)::text),
        coalesce(v_acc, '—'), coalesce(v_member, 'member'),
        coalesce(v_card, '—'));
    end if;

    if p_event.action in ('users.add', 'users.import', 'member_change.apply',
                          'usersData.update', 'usersData.insert') then
      select concat_ws(' ', u.surname || ',', u.first_name, u.middle_initial, u.suffix),
             u.library_id, u.role::text
        into v_member, v_card, v_role
      from public."usersData" u
      where u.id = p_event.entity_id;
      v_from := (select string_agg(key, ', ') from jsonb_object_keys(p_event.changes) as key
                 where key not in ('role'));
      if p_event.action in ('users.add', 'users.insert') then
        return format('Created member %s (%s, %s)',
          coalesce(v_member, 'new member'), coalesce(v_card, '—'),
          coalesce(v_role, 'role not set'));
      elsif p_event.action = 'users.import' then
        return format('Imported member %s (%s, %s)',
          coalesce(v_member, 'new member'), coalesce(v_card, '—'),
          coalesce(v_role, 'role not set'));
      elsif p_event.action = 'member_change.apply' then
        return format('Applied member edit for %s (%s)%s',
          coalesce(v_member, 'member'), coalesce(v_card, '—'),
          case when v_from is not null then ' — fields: ' || v_from else '' end);
      else
        return format('Edited member record %s (%s)%s',
          coalesce(v_member, '#' || coalesce(p_event.entity_id, 0)::text),
          coalesce(v_card, '—'),
          case when v_from is not null then ' — fields: ' || v_from else '' end);
      end if;
    end if;

    if p_event.action in ('member_change.request', 'enrollment.request') then
      return case p_event.action
        when 'member_change.request' then 'Submitted a member-edit request'
        else 'Submitted an enrollment change request'
      end;
    end if;

    if p_event.action in ('member_change.review', 'enrollment.review') then
      return case p_event.action
        when 'member_change.review' then 'Reviewed a member-edit request'
        else 'Reviewed an enrollment change request'
      end;
    end if;

    if p_event.action = 'enrollment.apply' then
      return format('Applied enrollment change for member #%s',
        coalesce(p_event.entity_id, 0));
    end if;

    if p_event.action = 'semesters.activate' then
      select s.name || ' (' ||
             to_char(s.starts_on, 'Mon FMDD, YYYY') || ' – ' ||
             to_char(s.ends_on, 'Mon FMDD, YYYY') || ')'
        into v_name
      from public.semesters s
      where s.id = p_event.entity_id;
      return format('Activated semester %s',
        coalesce(v_name, '#' || coalesce(p_event.entity_id, 0)::text));
    end if;

    if p_event.action = 'catalog.book.add' then
      select b.book_name into v_book
      from public.books b where b.id = p_event.entity_id;
      return format('Added book %s', quote_literal(coalesce(v_book, '#' || coalesce(p_event.entity_id, 0)::text)));
    end if;

    if p_event.action = 'catalog.copies.save' then
      select b.book_name, a.accession_number
        into v_book, v_acc
      from public.book_accession_numbers a
      join public.books b on b.id = a.book_id
      where a.id = p_event.entity_id;
      return format('%s copy %s for %s',
        case lower(coalesce(p_event.meta ->> 'op', ''))
          when 'insert' then 'Added'
          when 'delete' then 'Removed'
          else 'Updated'
        end,
        coalesce(v_acc, '#' || coalesce(p_event.entity_id, 0)::text),
        quote_literal(coalesce(v_book, 'book')));
    end if;

    if p_event.action in ('barcode.add', 'barcode.remove') then
      select e.accession_number into v_acc
      from public.barcode_entries e where e.id = p_event.entity_id;
      return format('%s barcode number %s',
        case p_event.action when 'barcode.add' then 'Added' else 'Removed' end,
        coalesce(v_acc, '#' || coalesce(p_event.entity_id, 0)::text));
    end if;

    if p_event.action = 'barcode.template.create' then
      select t.name || ' with ' || t.item_count || ' number' ||
             case when t.item_count = 1 then '' else 's' end
        into v_name
      from public.barcode_templates t where t.id = p_event.entity_id;
      return format('Created barcode template %s',
        quote_literal(coalesce(v_name, '#' || coalesce(p_event.entity_id, 0)::text)));
    end if;

    if p_event.action = 'attendance.insert' or p_event.action = 'attendance.update' then
      return case
        when p_event.action = 'attendance.insert' then 'Recorded a visit time-in'
        else 'Recorded a visit time-out'
      end;
    end if;

    if p_event.action like '%.auto' and p_event.entity_type = 'book_accession_numbers' then
      select a.accession_number, a.condition into v_acc, v_condition
      from public.book_accession_numbers a
      where a.id = p_event.entity_id;
      if v_acc is not null then
        return format('Copy %s condition updated automatically (now %s) — side effect of %s',
          v_acc, coalesce(v_condition, 'not set'),
          replace(p_event.action, '.auto', ''));
      end if;
    end if;
  exception when others then
    null;  -- fall through to the generic text
  end;

  -- generic fallback (names the record + the operation; never "updated")
  return format('%s %s #%s%s',
    case lower(coalesce(p_event.meta ->> 'op', ''))
      when 'insert' then 'Created'
      when 'delete' then 'Removed'
      else 'Changed'
    end,
    case p_event.entity_type
      when 'books' then 'book record'
      when '"usersData"' then 'member record'
      when 'usersData' then 'member record'
      when 'book_loans' then 'loan record'
      when 'book_accession_numbers' then 'copy record'
      when 'student_enrollments' then 'enrollment record'
      when 'attendance' then 'visit record'
      when 'inventory_entries' then 'inventory entry'
      when 'inventory_sessions' then 'inventory'
      when 'semesters' then 'semester'
      when 'academic_years' then 'academic year'
      when 'barcode_entries' then 'barcode number'
      when 'barcode_templates' then 'barcode template'
      else p_event.entity_type
    end,
    coalesce(p_event.entity_id, 0),
    case when v_reason is not null then ' — ' || v_reason else '' end);
end $$;
revoke all on function lirc_private.describe_activity(public.activity_events)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Feed
-- ---------------------------------------------------------------------------
create or replace function public.lirc_activity_feed(
  p_scope text default 'own',
  p_filters jsonb default '{}'::jsonb,
  p_before_occurred_at timestamptz default null,
  p_before_id bigint default null,
  p_page_size integer default 25)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me bigint := lirc_private.my_profile_id();
  v_scope text := coalesce(lower(btrim(coalesce(p_scope, 'own'))), 'own');
  v_limit integer := least(greatest(coalesce(p_page_size, 25), 1), 100);
  v_rows jsonb;
  v_has_more boolean := false;
  v_next_time timestamptz;
  v_next_id bigint;
  v_action text;
  v_prefix text;
  v_entity_type text;
  v_entity_id bigint;
  v_source text;
  v_from timestamptz;
  v_to timestamptz;
begin
  if v_me is null then
    raise exception 'No library profile for this account.' using errcode = '42501';
  end if;
  if v_scope not in ('own', 'all') then
    raise exception 'Unknown scope.';
  end if;
  if v_scope = 'all' and not lirc_private.is_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;

  v_action := nullif(p_filters ->> 'action', '');
  v_prefix := nullif(p_filters ->> 'action_prefix', '');
  v_entity_type := nullif(p_filters ->> 'entity_type', '');
  v_entity_id := nullif(p_filters ->> 'entity_id', '')::bigint;
  v_source := nullif(p_filters ->> 'source', '');
  v_from := nullif(p_filters ->> 'from_occurred_at', '')::timestamptz;
  v_to := nullif(p_filters ->> 'to_occurred_at', '')::timestamptz;

  with base as (
    select e.*
    from public.activity_events e
    where (v_scope = 'all' or e.actor_profile_id = v_me)
      and (v_action is null or e.action = v_action)
      and (v_prefix is null or e.action like v_prefix || '%')
      and (v_entity_type is null or e.entity_type = v_entity_type)
      and (v_entity_id is null or e.entity_id = v_entity_id)
      and (v_source is null or e.source = v_source)
      and (v_from is null or e.occurred_at >= v_from)
      and (v_to is null or e.occurred_at < v_to)
      and (p_before_occurred_at is null
           or (e.occurred_at, e.id) < (p_before_occurred_at, coalesce(p_before_id, 0)))
    order by e.occurred_at desc, e.id desc
    limit v_limit + 1
  ),
  page as (
    select * from base order by occurred_at desc, id desc limit v_limit
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'occurred_at', p.occurred_at,
      'action', p.action,
      'source', p.source,
      'actor_kind', p.actor_kind,
      'actor_profile_id', p.actor_profile_id,
      'actor_name', concat_ws(' ', u.first_name, u.middle_initial, u.surname, u.suffix),
      'actor_role', p.actor_role,
      'entity_type', p.entity_type,
      'entity_id', p.entity_id,
      'operation_id', p.operation_id,
      'parent_type', p.parent_type,
      'parent_id', p.parent_id,
      'changes', p.changes,
      'reason', p.reason,
      'description', lirc_private.describe_activity(p))
      order by p.occurred_at desc, p.id desc), '[]'::jsonb),
    (select count(*) from base) > (select count(*) from page),
    (select p.occurred_at from page p order by p.occurred_at asc, p.id asc limit 1),
    (select p.id from page p order by p.occurred_at asc, p.id asc limit 1)
  into v_rows, v_has_more, v_next_time, v_next_id
  from page p
  left join public."usersData" u on u.id = p.actor_profile_id;

  return jsonb_build_object(
    'rows', v_rows,
    'has_more', coalesce(v_has_more, false),
    'next_before_occurred_at', case when v_has_more then v_next_time end,
    'next_before_id', case when v_has_more then v_next_id end);
end $$;
revoke all on function public.lirc_activity_feed(text, jsonb, timestamptz, bigint, integer)
  from public, anon;
grant execute on function public.lirc_activity_feed(text, jsonb, timestamptz, bigint, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Trace one operation
-- ---------------------------------------------------------------------------
create or replace function public.lirc_activity_trace(p_operation_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me bigint := lirc_private.my_profile_id();
  v_admin boolean := lirc_private.is_admin();
  v_rows jsonb;
begin
  if v_me is null then
    raise exception 'No library profile for this account.' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'occurred_at', e.occurred_at,
    'action', e.action,
    'source', e.source,
    'actor_profile_id', e.actor_profile_id,
    'entity_type', e.entity_type,
    'entity_id', e.entity_id,
    'parent_type', e.parent_type,
    'parent_id', e.parent_id,
    'changes', e.changes,
    'description', lirc_private.describe_activity(e))
    order by e.occurred_at, e.id), '[]'::jsonb)
  into v_rows
  from public.activity_events e
  where e.operation_id = p_operation_id
    and (v_admin or e.actor_profile_id = v_me);
  return jsonb_build_object('operation_id', p_operation_id, 'rows', v_rows);
end $$;
revoke all on function public.lirc_activity_trace(uuid)
  from public, anon;
grant execute on function public.lirc_activity_trace(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- History of one record
-- ---------------------------------------------------------------------------
create or replace function public.lirc_activity_for_entity(
  p_entity_type text,
  p_entity_id bigint,
  p_before_occurred_at timestamptz default null,
  p_before_id bigint default null,
  p_page_size integer default 25)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me bigint := lirc_private.my_profile_id();
  v_admin boolean := lirc_private.is_admin();
  v_limit integer := least(greatest(coalesce(p_page_size, 25), 1), 100);
  v_type text := btrim(coalesce(p_entity_type, ''));
  v_rows jsonb;
  v_has_more boolean := false;
  v_next_time timestamptz;
  v_next_id bigint;
begin
  if v_me is null then
    raise exception 'No library profile for this account.' using errcode = '42501';
  end if;
  if v_type = '' or p_entity_id is null then
    raise exception 'A record type and id are required.';
  end if;

  with base as (
    select e.*
    from public.activity_events e
    where e.entity_type = v_type
      and e.entity_id = p_entity_id
      and (v_admin or e.actor_profile_id = v_me)
      and (p_before_occurred_at is null
           or (e.occurred_at, e.id) < (p_before_occurred_at, coalesce(p_before_id, 0)))
    order by e.occurred_at desc, e.id desc
    limit v_limit + 1
  ),
  page as (
    select * from base order by occurred_at desc, id desc limit v_limit
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'occurred_at', p.occurred_at,
      'action', p.action,
      'source', p.source,
      'actor_profile_id', p.actor_profile_id,
      'actor_name', concat_ws(' ', u.first_name, u.middle_initial, u.surname, u.suffix),
      'changes', p.changes,
      'description', lirc_private.describe_activity(p))
      order by p.occurred_at desc, p.id desc), '[]'::jsonb),
    (select count(*) from base) > (select count(*) from page),
    (select p.occurred_at from page p order by p.occurred_at asc, p.id asc limit 1),
    (select p.id from page p order by p.occurred_at asc, p.id asc limit 1)
  into v_rows, v_has_more, v_next_time, v_next_id
  from page p
  left join public."usersData" u on u.id = p.actor_profile_id;

  return jsonb_build_object(
    'rows', v_rows,
    'has_more', coalesce(v_has_more, false),
    'next_before_occurred_at', case when v_has_more then v_next_time end,
    'next_before_id', case when v_has_more then v_next_id end);
end $$;
revoke all on function public.lirc_activity_for_entity(text, bigint, timestamptz, bigint, integer)
  from public, anon;
grant execute on function public.lirc_activity_for_entity(text, bigint, timestamptz, bigint, integer)
  to authenticated;

notify pgrst, 'reload schema';
commit;
