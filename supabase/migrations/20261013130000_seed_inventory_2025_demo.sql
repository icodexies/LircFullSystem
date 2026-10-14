-- DEMO DATA: one finished 2025 inventory ("Annual Inventory 2025") that
-- found every copy in Good Condition. It gives the Inventory history and the
-- copies' current conditions sample data to show.
-- Recorded by the first admin profile. The script skips itself when an
-- inventory for 2025 already exists.
begin;

do $$
declare
  v_staff bigint;
  v_total bigint;
  v_session_id bigint;
  v_scanned_at timestamptz := timestamptz '2025-05-15 09:00+08';
  v_started_at timestamptz := timestamptz '2025-05-14 08:00+08';
  v_finished_at timestamptz := timestamptz '2025-05-15 16:00+08';
  v_summary jsonb;
begin
  if exists (select 1 from public.inventory_sessions s where s.year = 2025) then
    raise notice 'A 2025 inventory already exists; demo seed skipped.';
    return;
  end if;

  select u.id into v_staff
  from public."usersData" u
  where lower(btrim(u.role::text)) = 'admin'
  order by u.id
  limit 1;
  if v_staff is null then
    raise notice 'No admin profile found; demo inventory skipped.';
    return;
  end if;

  select count(*) into v_total from public.book_accession_numbers;
  if v_total = 0 then
    raise notice 'No accession copies found; demo inventory skipped.';
    return;
  end if;

  insert into public.inventory_sessions
    (name, year, status, created_by, created_at, finished_by, finished_at)
  values
    ('Annual Inventory 2025', 2025, 'finished', v_staff, v_started_at,
     v_staff, v_finished_at)
  returning id into v_session_id;

  -- Every copy was found and saved as Good Condition.
  insert into public.inventory_entries
    (session_id, accession_id, outcome, condition, recorded_by, recorded_at)
  select v_session_id, a.id, 'Found', 'Good', v_staff, v_scanned_at
  from public.book_accession_numbers a;

  -- The copies' current condition is now the 2025 result.
  update public.book_accession_numbers set condition = 'Good';

  v_summary := jsonb_build_object(
    'total', v_total,
    'found', v_total,
    'found_good', v_total,
    'found_damaged', 0,
    'missing', 0,
    'not_checked', 0,
    'borrowed', 0,
    'remaining', 0);
  update public.inventory_sessions
     set summary = v_summary
   where id = v_session_id;

  raise notice 'Seeded Annual Inventory 2025 with % found copies.', v_total;
end $$;

commit;
