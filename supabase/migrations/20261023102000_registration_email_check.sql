-- ============================================================================
-- Registration email lookup
--
-- The public registration request must reject an email that already belongs to
-- an auth account. Supabase Auth's admin API does not expose a direct
-- lookup-by-email helper, so this narrow security-definer function is callable
-- only by the service role used by the registration edge function.
-- ============================================================================
begin;

create or replace function public.lirc_email_has_account(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users
    where lower(email) = lower(btrim(p_email))
  );
$$;

revoke all on function public.lirc_email_has_account(text)
  from public, anon, authenticated;
grant execute on function public.lirc_email_has_account(text) to service_role;

comment on function public.lirc_email_has_account(text) is
  'True when an auth account already uses this email. Service-role only; used by registration before sending a link.';

notify pgrst, 'reload schema';
commit;
