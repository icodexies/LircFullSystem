# Registration (email-link claim flow)

Registration is for people who already have a library profile (`usersData`) but
no login yet. It does **not** create a new roster record.

## Flow

1. **CCC email only** — the visitor enters their CCC email on `/register`.
   The page says “CCC email” without spelling out the domain; the server still
   accepts only `@ccc.edu.ph` addresses.
   Before any link is sent, the server rejects an email that already has an
   auth account with a clear error (log in or reset the password).
2. **Secure link** — the `registration` edge function creates a random token
   (only its SHA-256 hash is stored in `public.registration_tokens`) and emails
   `/register?token=...` from the library Gmail. The link expires after
   **30 minutes** and can be used once.
3. **Verify the roster record** — the link asks for the library ID, surname,
   first name and middle initial. The server compares them with the existing
   `usersData` row (case-insensitive, whitespace-collapsed, first letter of the
   middle initial). A mismatch reveals nothing beyond “couldn’t match”.
4. **Set a password** — the page asks for password + confirmation. Rules:
   at least 8 characters (max 72), one uppercase, one lowercase and one number.
   The same rules are enforced server-side.
5. **Create the account** — the server creates the Supabase Auth user with that
   email/password, links the existing profile (`user_id`), and marks the token
   used. The page signs the new account in and opens the dashboard.

## Security

- The raw token exists only in the email; the database stores a hash.
- Tokens are single-use and expire; a new request invalidates the previous
  unused link for that email.
- New CCC addresses receive the same generic reply. Per the current product
  requirement, an address that already has an account is rejected explicitly.
  The endpoint never reveals roster/library-ID details.
- Only `service_role` can read/write `registration_tokens`; RLS is enabled and
  all public/authenticated grants are revoked.
- Passwords are never stored by the library system — Supabase Auth hashes them.
- If the library ID/name does not match, the visitor is told to visit the
  library office; staff can correct the roster.

## Deploying

```bash
npx supabase db query --linked --file supabase/migrations/20261023100000_registration_tokens.sql
npx supabase functions deploy registration --project-ref <ref>
npm run build
node scripts/deploy-vercel.mjs
```

The old `register-user` function and generated-password email flow were
removed. `SITE_URL` and the Gmail secrets are required in the function
environment.
