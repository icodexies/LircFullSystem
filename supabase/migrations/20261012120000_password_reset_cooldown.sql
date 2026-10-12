-- Cooldown tracking for password reset emails.
-- The request-password-reset function writes one row per email address
-- (service role only) so the same address cannot be emailed too often.
-- RLS is enabled with no policies: API clients (anon / authenticated)
-- cannot read or write this table at all.
begin;

create table if not exists public.password_reset_requests (
  email text primary key,
  requested_at timestamptz not null default now()
);

alter table public.password_reset_requests enable row level security;
revoke all privileges on table public.password_reset_requests from public, anon, authenticated;
grant all privileges on table public.password_reset_requests to service_role;

notify pgrst, 'reload schema';
commit;
