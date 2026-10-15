-- ============================================================================
-- Daily overdue reminders. Borrowers (students, faculty, staff) get a bell
-- notification on the day a book is due and then once every day while it
-- stays overdue — up to 30 days past the due date, then it stops.
--
--   * notifications gains `dedupe_key` (one reminder per loan per day, so
--     re-running the job never duplicates a day).
--   * lirc_private.send_overdue_reminders() inserts today's reminders and
--     returns how many were created.
--   * pg_cron runs it every day at 08:00 Philippine time (00:00 UTC).
--
-- Members without a login still get the row recorded (nothing shows for them
-- until they have an account).
-- ============================================================================
begin;

create extension if not exists pg_cron;

alter table public.notifications
  add column if not exists dedupe_key text;

create unique index if not exists notifications_dedupe_idx
  on public.notifications (user_profile_id, dedupe_key);

create or replace function lirc_private.send_overdue_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_count integer;
begin
  with due as (
    select l.id as loan_id,
           l.user_profile_id,
           b.book_name,
           a.accession_number,
           (l.due_at at time zone 'Asia/Manila')::date as due_day,
           v_today - (l.due_at at time zone 'Asia/Manila')::date as days_overdue
    from public.book_loans l
    join public.book_accession_numbers a on a.id = l.accession_id
    join public.books b on b.id = a.book_id
    where l.returned_at is null
      and (l.due_at at time zone 'Asia/Manila')::date <= v_today
      and (l.due_at at time zone 'Asia/Manila')::date >= v_today - 30
  )
  insert into public.notifications
    (user_profile_id, type, title, message, link, dedupe_key)
  select d.user_profile_id,
         'overdue',
         case when d.days_overdue = 0
              then 'Book due today'
              else 'Overdue book reminder' end,
         case when d.days_overdue = 0
              then format('"%s" (%s) is due today. Return or renew it at the library.',
                          d.book_name, d.accession_number)
              else format('"%s" (%s) was due %s — %s day(s) overdue. Please return it to the library.',
                          d.book_name, d.accession_number,
                          to_char(d.due_day, 'Mon DD, YYYY'), d.days_overdue) end,
         null,
         format('overdue:%s:%s', d.loan_id, v_today)
  from due d
  on conflict (user_profile_id, dedupe_key) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke all on function lirc_private.send_overdue_reminders()
  from public, anon, authenticated;

-- Every day at 08:00 Philippine time (00:00 UTC). Scheduling again with the
-- same name replaces the old schedule.
select cron.schedule(
  'lirc-overdue-reminders',
  '0 0 * * *',
  $$select lirc_private.send_overdue_reminders()$$);

commit;
