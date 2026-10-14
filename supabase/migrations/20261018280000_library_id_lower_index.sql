-- ============================================================================
-- Cleanup: one missing index. Card lookups and duplicate checks compare
-- lower(library_id) (member lookup, add-user, CSV import), which the unique
-- index on library_id cannot serve.
-- ============================================================================
begin;

create index if not exists idx_users_library_id_lower
  on public."usersData" (lower(library_id));

notify pgrst, 'reload schema';
commit;
