-- ============================================================================
-- Hotfix: restore EXECUTE on the helpers used inside RLS policies.
--
-- Row policies are evaluated with the querying user's privileges, so a
-- helper called from a policy must stay executable by the roles that query
-- the table directly. The previous migration revoked these, which broke the
-- usersData profile read (403) and the enrollment table policies.
--
-- attendance_staff_id is called by the usersData read policy and the
-- attendance policies; validation_staff_id by the enrollment policies.
-- Both only ever return the caller's own profile id (or null), so granting
-- execute back to the public role is safe — it restores the state the
-- policies were written against.
-- ============================================================================
begin;

grant execute on function lirc_private.attendance_staff_id() to public;
grant execute on function lirc_private.validation_staff_id() to public;

notify pgrst, 'reload schema';
commit;
