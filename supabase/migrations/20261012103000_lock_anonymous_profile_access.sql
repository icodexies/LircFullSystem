-- Lock the profiles table for anonymous callers.
-- Signed-in users keep the existing row-level rules: they read only their
-- own profile, and staff keep the boundary allowance. Anonymous requests
-- now receive a permission error like other private tables, instead of an
-- empty result. No profile data or accounts are changed.
begin;

revoke all privileges on table public."usersData" from anon;

-- Remove any leftover column-level grants for anon as well; revoking the
-- table grant alone does not remove column privileges.
do $$
declare column_list text;
begin
  select pg_catalog.string_agg(pg_catalog.format('%I', a.attname), ', ')
    into column_list
    from pg_catalog.pg_attribute a
   where a.attrelid = pg_catalog.to_regclass('public."usersData"')
     and a.attnum > 0 and not a.attisdropped;
  execute pg_catalog.format(
    'revoke all privileges (%s) on public."usersData" from anon',
    column_list
  );
end;
$$;

commit;
