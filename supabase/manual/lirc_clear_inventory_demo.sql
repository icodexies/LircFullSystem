-- CLEANUP: removes the sample "Annual Inventory 2025" records and re-derives
-- every copy's current condition from the remaining inventory records.
--
-- Use this when the demo inventory is no longer needed. It deletes ONLY the
-- 2025 sample session and its records; real inventories (and their records)
-- are kept. Run in the SQL editor, or as a migration when you prefer.
--
-- Check what is inside first if you like:
--   select count(*) from public.inventory_sessions where year = 2025;

begin;

delete from public.inventory_entries e
 where e.session_id in (
   select s.id from public.inventory_sessions s
   where s.year = 2025 and s.name = 'Annual Inventory 2025');

delete from public.inventory_sessions s
 where s.year = 2025 and s.name = 'Annual Inventory 2025';

-- Re-derive each copy's condition from its latest remaining record (blank
-- when no inventory record is left).
update public.book_accession_numbers a
   set condition = (
     select case when e.outcome = 'Missing' then 'Missing' else e.condition end
     from public.inventory_entries e
     where e.accession_id = a.id
     order by e.recorded_at desc, e.id desc
     limit 1);

commit;
