-- Wrap auth.uid() in the catalog role helper as a best-practice cleanup.
-- Behaviour is unchanged (staff still cannot pass; librarian/admin still can).
-- No standalone performance gain is claimed for this change.
begin;

create or replace function lirc_private.can_edit_catalog()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public."usersData" as u
    where u.user_id = (select auth.uid())
      and lower(trim(u.role::text)) in ('librarian', 'admin')
  );
$$;

revoke all on function lirc_private.can_edit_catalog() from public, anon;
grant execute on function lirc_private.can_edit_catalog() to authenticated, service_role;

commit;
