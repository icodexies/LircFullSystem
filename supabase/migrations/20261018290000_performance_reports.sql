-- ============================================================================
-- Monthly AI performance summaries.
--
-- 1. performance_reports — one row per person per month (the AI result).
--    Admin-only read; rows are written by the Edge Function (service role).
-- 2. lirc_performance_ai_input(profile, month) — the compact month dossier
--    handed to the AI: aggregates, quality signals and a spread sample of the
--    actual log sentences. Service-role only (the Edge Function calls it).
-- 3. lirc_performance_reports(profile) — the admin page's list (full rows).
--
-- Also grants EXECUTE on is_admin() to authenticated: it only answers
-- "is the caller an admin?" and several read policies use it, so the policy
-- works when a table is ever read directly.
-- ============================================================================
begin;

create table if not exists public.performance_reports (
  id bigint generated always as identity primary key,
  user_profile_id bigint not null references public."usersData"(id) on delete cascade,
  period_month date not null,
  rating_score integer not null check (rating_score between 0 and 100),
  rating_label text not null,
  headline text,
  summary jsonb not null default '{}'::jsonb,
  model text,
  generated_by bigint references public."usersData"(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists performance_reports_person_month
  on public.performance_reports (user_profile_id, period_month);

alter table public.performance_reports enable row level security;
revoke all privileges on table public.performance_reports
  from public, anon, authenticated;
grant select on table public.performance_reports to authenticated;
drop policy if exists "performance reports admin read" on public.performance_reports;
create policy "performance reports admin read" on public.performance_reports
  for select to authenticated using ((select lirc_private.is_admin()));

grant execute on function lirc_private.is_admin() to authenticated;

-- The AI's month dossier (service-role only) --------------------------------
create or replace function public.lirc_performance_ai_input(
  p_profile_id bigint,
  p_month date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_start date;
  v_end date;
  v_from timestamptz;
  v_to timestamptz;
  v_days integer;
  u record;
  v_total bigint;
  v_active integer;
  v_busiest_day date;
  v_busiest_count bigint;
  v_distinct integer;
  v_max_share numeric;
  v_after_hours bigint;
  v_weekend bigint;
  v_reviews bigint;
  v_validations bigint;
  v_kinds jsonb;
  v_top_actions jsonb;
  v_events jsonb;
begin
  v_start := date_trunc('month',
    coalesce(p_month, (now() at time zone 'Asia/Manila')::date))::date;
  v_end := (v_start + interval '1 month')::date;
  v_from := v_start::timestamp at time zone 'Asia/Manila';
  v_to := v_end::timestamp at time zone 'Asia/Manila';
  v_days := (v_end - v_start);

  select u2.id,
         concat_ws(' ', u2.first_name, u2.middle_initial, u2.surname, u2.suffix) as full_name,
         u2.role,
         u2.library_id,
         (select d.name from public.departments d where d.id = u2.department_id) as department,
         (select p.name from public.programs p where p.id = u2.program_id) as program,
         (select pc.name from public.position_classifications pc
           where pc.id = u2.position_classification_id) as position
    into u
    from public."usersData" u2
   where u2.id = p_profile_id;
  if u.id is null then
    raise exception 'Person not found.';
  end if;

  select count(*),
         count(distinct e.action),
         count(*) filter (where extract(hour from (e.occurred_at at time zone 'Asia/Manila')) < 7
                             or extract(hour from (e.occurred_at at time zone 'Asia/Manila')) >= 19),
         count(*) filter (where extract(isodow from (e.occurred_at at time zone 'Asia/Manila')) >= 6),
         count(*) filter (where e.action in ('member_change.review', 'enrollment.review')),
         count(*) filter (where e.action like 'enrollment.%'
                             or e.action like 'student_enrollments.%')
    into v_total, v_distinct, v_after_hours, v_weekend, v_reviews, v_validations
    from public.activity_events e
   where e.actor_profile_id = p_profile_id
     and e.occurred_at >= v_from and e.occurred_at < v_to;

  select count(*) filter (where n > 0) into v_active
    from (
      select (e.occurred_at at time zone 'Asia/Manila')::date as day, count(*) n
        from public.activity_events e
       where e.actor_profile_id = p_profile_id
         and e.occurred_at >= v_from and e.occurred_at < v_to
       group by 1) d;

  select d.day, d.n into v_busiest_day, v_busiest_count
    from (
      select (e.occurred_at at time zone 'Asia/Manila')::date as day, count(*) n
        from public.activity_events e
       where e.actor_profile_id = p_profile_id
         and e.occurred_at >= v_from and e.occurred_at < v_to
       group by 1
       order by 2 desc, 1 desc
       limit 1) d;

  -- the single most repeated action's share of the month (spam indicator)
  select coalesce(max(s.share), 0) into v_max_share
    from (
      select count(*)::numeric / greatest(v_total, 1) as share
        from public.activity_events e
       where e.actor_profile_id = p_profile_id
         and e.occurred_at >= v_from and e.occurred_at < v_to
       group by e.action) s;

  -- same work families as the dashboard donut
  select coalesce(jsonb_agg(jsonb_build_object('kind', x.kind, 'count', x.n)
                            order by x.n desc), '[]'::jsonb)
    into v_kinds
    from (
      select case
               when e.action like 'inventory.%' then 'inventory'
               when e.action like 'loans.%' or e.action like 'book_loans.%' then 'loans'
               when e.action like 'users.%' or e.action like 'usersData.%' then 'members'
               when e.action like 'member_change.%' then 'member_changes'
               when e.action like 'enrollment.%' or e.action like 'student_enrollments.%' then 'validation'
               when e.action like 'catalog.%' or e.action like 'books.%'
                    or e.action like 'book_accession_numbers.%' then 'catalog'
               when e.action like 'attendance.%' then 'attendance'
               when e.action like 'semesters.%' or e.action like 'academic_years.%' then 'periods'
               when e.action like 'barcode.%' or e.action like 'barcode_entries.%'
                    or e.action like 'barcode_templates.%' then 'barcode'
               else 'other'
             end as kind,
             count(*) as n
        from public.activity_events e
       where e.actor_profile_id = p_profile_id
         and e.occurred_at >= v_from and e.occurred_at < v_to
       group by 1) x;

  select coalesce(jsonb_agg(jsonb_build_object('action', x.action, 'count', x.n)
                            order by x.n desc), '[]'::jsonb)
    into v_top_actions
    from (
      select e.action, count(*) as n
        from public.activity_events e
       where e.actor_profile_id = p_profile_id
         and e.occurred_at >= v_from and e.occurred_at < v_to
       group by 1
       order by 2 desc, 1
       limit 12) x;

  -- a spread sample: up to 4 log sentences per active day, read as plain words
  select coalesce(jsonb_agg(jsonb_build_object('at', x.at, 'what', x.what)
                            order by x.at), '[]'::jsonb)
    into v_events
    from (
      select to_char(e.occurred_at at time zone 'Asia/Manila',
                     'Mon DD, HH12:MI AM') as at,
             lirc_private.describe_activity(e) as what,
             row_number() over (
               partition by (e.occurred_at at time zone 'Asia/Manila')::date
               order by e.occurred_at desc) as rn
        from public.activity_events e
       where e.actor_profile_id = p_profile_id
         and e.occurred_at >= v_from and e.occurred_at < v_to) x
   where x.rn <= 4;

  return jsonb_build_object(
    'profile', jsonb_build_object(
      'name', u.full_name, 'role', u.role, 'library_id', u.library_id,
      'department', u.department, 'program', u.program, 'position', u.position),
    'month', to_char(v_start, 'YYYY-MM'),
    'days_in_month', v_days,
    'totals', jsonb_build_object(
      'actions', v_total, 'active_days', v_active,
      'busiest_day', v_busiest_day, 'busiest_count', v_busiest_count),
    'signals', jsonb_build_object(
      'distinct_action_types', v_distinct,
      'max_single_action_share', round(v_max_share, 2),
      'after_hours_actions', v_after_hours,
      'weekend_actions', v_weekend,
      'review_actions', v_reviews,
      'validation_actions', v_validations),
    'by_kind', v_kinds,
    'top_actions', v_top_actions,
    'events', v_events);
end $$;
revoke all on function public.lirc_performance_ai_input(bigint, date)
  from public, anon, authenticated;
grant execute on function public.lirc_performance_ai_input(bigint, date)
  to service_role;

-- The admin page's list -----------------------------------------------------
create or replace function public.lirc_performance_reports(p_profile_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not lirc_private.is_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id,
           'period_month', r.period_month,
           'rating_score', r.rating_score,
           'rating_label', r.rating_label,
           'headline', r.headline,
           'summary', r.summary,
           'model', r.model,
           'created_at', r.created_at,
           'generated_by', nullif(concat_ws(' ', gb.first_name, gb.surname), ''))
         order by r.period_month desc, r.id desc), '[]'::jsonb)
    into result
    from public.performance_reports r
    left join public."usersData" gb on gb.id = r.generated_by
   where r.user_profile_id = p_profile_id;
  return result;
end $$;
revoke all on function public.lirc_performance_reports(bigint)
  from public, anon;
grant execute on function public.lirc_performance_reports(bigint)
  to authenticated;

notify pgrst, 'reload schema';
commit;
