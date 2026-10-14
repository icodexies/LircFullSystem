-- ============================================================================
-- Stage 1e: provenance labels (evidence-based, nothing deleted)
--
-- Labels: live | demo | seed | setup | import | unknown (nullable — NULL means
-- "not labelled", which is the normal state for new live rows).
--
-- Every backfill below is evidence-based, idempotent (only touches NULL
-- labels) and recorded in provenance_batches with its criteria and the exact
-- number of rows it changed.
--
-- Evidence verified live on 2026-10-14:
--   * books / copies: all created 2026-10-08 (seed load)
--   * book_loans: 12,000 rows created 2026-10-12 14:13/14:17 UTC (seed batch);
--     1 row created 2026-10-12 15:13 UTC (app-created, one-off → unknown)
--   * attendance: 10,000 rows before 2026-10-01 (September demo);
--     6 rows on 2026-10-12 (one-off → unknown)
--   * "Annual Inventory 2025" is the finished demo (6,259 entries inherit);
--     "Annual Inventory 2026" is the open pilot session → live
--   * barcode: 148 entries / 3 templates, all one-off testing → unknown
--   * student_enrollments: one documented one-time setup (validation_reference)
--
-- usersData profiles are deliberately left unlabelled (mixed provenance;
-- uncertain stays unlabelled for now — see docs).
-- ============================================================================
begin;

-- These backfills are a labelled, owner-run migration. Some tables
-- (attendance, student_enrollments, catalog) carry guard triggers that only
-- let signed-in staff write, and a migration has no signed-in session.
-- session_replication_role is a transaction-local switch that skips USER
-- triggers for the rest of THIS migration only: foreign keys and check
-- constraints stay enforced, and the value is reset again before commit.
-- Nothing is weakened permanently.
set local session_replication_role = replica;

-- ---------------------------------------------------------------------------
-- 1. provenance_batches (audit of the labelling itself)
-- ---------------------------------------------------------------------------
create table if not exists public.provenance_batches (
  id bigint generated always as identity primary key,
  label text not null
    check (label in ('live', 'demo', 'seed', 'setup', 'import', 'unknown')),
  table_name text not null,
  criteria text not null,
  row_count bigint not null default 0,
  actor text not null default 'migration',
  note text,
  created_at timestamptz not null default clock_timestamp()
);

alter table public.provenance_batches enable row level security;

drop policy if exists provenance_batches_admin_select on public.provenance_batches;
create policy provenance_batches_admin_select on public.provenance_batches
  for select to authenticated
  using (lirc_private.is_admin());

revoke all on table public.provenance_batches from public, anon, authenticated;
grant select on table public.provenance_batches to authenticated;

-- ---------------------------------------------------------------------------
-- 2. provenance columns + checks
-- ---------------------------------------------------------------------------
do $$
declare
  v_tables text[] := array[
    'usersData', 'books', 'book_accession_numbers', 'attendance',
    'book_loans', 'student_enrollments', 'inventory_sessions',
    'barcode_entries', 'barcode_templates'];
  v_t text;
begin
  foreach v_t in array v_tables loop
    execute format(
      'alter table public.%I add column if not exists provenance text', v_t);
    if not exists (
      select 1 from pg_constraint
      where conname = lower(v_t) || '_provenance_check') then
      execute format(
        'alter table public.%I add constraint %I '
        'check (provenance is null or provenance in '
        '(''live'', ''demo'', ''seed'', ''setup'', ''import'', ''unknown''))',
        v_t, lower(v_t) || '_provenance_check');
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Backfills (each update is paired with its provenance_batches record)
-- ---------------------------------------------------------------------------

-- demo: the bulk seed loans
with u as (
  update public.book_loans
     set provenance = 'demo'
   where provenance is null
     and created_at < '2026-10-12 15:00:00+00'
  returning 1)
insert into public.provenance_batches (label, table_name, criteria, row_count, note)
select 'demo', 'book_loans',
       'created_at < 2026-10-12 15:00 UTC (seed batch 20261012190000/20261012200000)',
       count(*), 'Bulk seeded loans; kept for history, excluded from credit.'
from u having count(*) > 0;

-- unknown: the one app-created loan (one-off, pending user confirmation)
with u as (
  update public.book_loans
     set provenance = 'unknown'
   where provenance is null
     and created_at >= '2026-10-12 15:00:00+00'
  returning 1)
insert into public.provenance_batches (label, table_name, criteria, row_count, note)
select 'unknown', 'book_loans',
       'created_at >= 2026-10-12 15:00 UTC (app-created one-off)',
       count(*), 'One-off October row; awaiting user confirmation.'
from u having count(*) > 0;

-- demo: September attendance
with u as (
  update public.attendance
     set provenance = 'demo'
   where provenance is null
     and time_in < '2026-10-01'
  returning 1)
insert into public.provenance_batches (label, table_name, criteria, row_count, note)
select 'demo', 'attendance',
       'time_in < 2026-10-01 (September demo 20261012130000)',
       count(*), 'Seeded September visits.'
from u having count(*) > 0;

-- unknown: the six scanner visits
with u as (
  update public.attendance
     set provenance = 'unknown'
   where provenance is null
     and time_in >= '2026-10-01'
  returning 1)
insert into public.provenance_batches (label, table_name, criteria, row_count, note)
select 'unknown', 'attendance',
       'time_in >= 2026-10-01 (scanner one-offs)',
       count(*), 'Six October rows; awaiting user confirmation.'
from u having count(*) > 0;

-- demo: the finished 2025 inventory session (entries inherit)
with u as (
  update public.inventory_sessions
     set provenance = 'demo'
   where provenance is null
     and name = 'Annual Inventory 2025'
  returning 1)
insert into public.provenance_batches (label, table_name, criteria, row_count, note)
select 'demo', 'inventory_sessions',
       'name = ''Annual Inventory 2025'' (entries inherit via session)',
       count(*), 'Finished demo inventory with 6,259 demo entries.'
from u having count(*) > 0;

-- live: the open pilot session
with u as (
  update public.inventory_sessions
     set provenance = 'live'
   where provenance is null
     and name = 'Annual Inventory 2026'
  returning 1)
insert into public.provenance_batches (label, table_name, criteria, row_count, note)
select 'live', 'inventory_sessions',
       'name = ''Annual Inventory 2026'' (pilot session, decision 2026-10-14)',
       count(*), 'Existing open session chosen as the personnel-dashboard pilot.'
from u having count(*) > 0;

-- seed: catalog loaded 2026-10-08
with u as (
  update public.books
     set provenance = 'seed'
   where provenance is null
     and created_at < '2026-10-09'
  returning 1)
insert into public.provenance_batches (label, table_name, criteria, row_count, note)
select 'seed', 'books',
       'created_at < 2026-10-09 (catalog seed load)',
       count(*), 'Seeded catalog.'
from u having count(*) > 0;

with u as (
  update public.book_accession_numbers
     set provenance = 'seed'
   where provenance is null
     and created_at < '2026-10-09'
  returning 1)
insert into public.provenance_batches (label, table_name, criteria, row_count, note)
select 'seed', 'book_accession_numbers',
       'created_at < 2026-10-09 (catalog seed load)',
       count(*), 'Seeded copies.'
from u having count(*) > 0;

-- unknown: barcode testing (one-off)
with u as (
  update public.barcode_entries
     set provenance = 'unknown'
   where provenance is null
  returning 1)
insert into public.provenance_batches (label, table_name, criteria, row_count, note)
select 'unknown', 'barcode_entries',
       'all rows (one-off testing by admin #1)',
       count(*), 'Awaiting user confirmation.'
from u having count(*) > 0;

with u as (
  update public.barcode_templates
     set provenance = 'unknown'
   where provenance is null
  returning 1)
insert into public.provenance_batches (label, table_name, criteria, row_count, note)
select 'unknown', 'barcode_templates',
       'all rows (one-off testing by admin #1)',
       count(*), 'Awaiting user confirmation.'
from u having count(*) > 0;

-- setup: the documented one-time enrollment initialisation
with u as (
  update public.student_enrollments
     set provenance = 'setup'
   where provenance is null
  returning 1)
insert into public.provenance_batches (label, table_name, criteria, row_count, note)
select 'setup', 'student_enrollments',
       'all rows (one-time initial validation reference)',
       count(*), 'Enrollment assumed during initial 2026-2027 setup; documented in validation_reference.'
from u having count(*) > 0;

set local session_replication_role = origin;
notify pgrst, 'reload schema';
commit;
