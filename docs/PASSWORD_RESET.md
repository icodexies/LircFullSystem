# Password reset (the "Forgot password?" flow)

Users who forget their password ask for a reset link by email. The link opens
a "Choose a new password" page that uses the same design as the registration
page. Everything is free for the school: the email goes through the same
Gmail account that registration already uses.

## The flow, step by step

1. On the Home page, the login window has a **Forgot?** link. It opens
   `/forgot-password`, or the page can be opened directly.
2. The visitor types their email. The app calls the `request-password-reset`
   edge function.
3. The function asks Supabase Auth for a **one-time recovery token** and emails
   a link that points back to the website:
   `https://your-site/reset-password?token_hash=...&type=recovery`
4. The visitor opens the link. The page signs them in with the one-time token
   (`verifyOtp`), then saves the new password (`updateUser`), then hides the
   token from the address bar.
5. They land on their dashboard, or can log in again with the new password.

## The files involved

| File | Job |
| --- | --- |
| `supabase/functions/request-password-reset/index.ts` | Public function that creates the token and sends the email |
| `supabase/migrations/20261012120000_password_reset_cooldown.sql` | One tiny table that limits how often one email can be sent (applied to the live database on 12 October 2026) |
| `src/pages/PublicPages/ForgotPasswordPage/ForgotPassword.jsx` | The "type your email" page |
| `src/pages/PublicPages/ResetPasswordPage/ResetPassword.jsx` | The "choose a new password" page from the email link |
| `src/components/auth/AuthShell.jsx` | The shared register-page design used by all three auth pages |
| `src/components/auth/LoginModal.jsx` | Has the Forgot? link (the `onForgot` prop) |
| `src/services/auth/authService.js` | `requestPasswordReset` and `completePasswordReset` |
| `src/services/auth/passwordRules.js` | Password rules checked before saving (8–72 characters, both entries must match) |

## Security choices (and why)

- **Same reply for every email.** "If that email has an account, we sent a
  link" — so nobody can use this page to discover who has an account
  (this is called preventing *account enumeration*).
- **One email per address per 2 minutes.** The cooldown value lives in
  `index.ts` (`RESEND_COOLDOWN_SECONDS`). The tracking table has RLS enabled
  with **no policies**, so only the server (service role) can read or write
  it — the browser cannot touch it at all.
- **One-time links.** The token is created by Supabase Auth, works once, and
  expires on its own. The function never stores or logs it.
- **No password over email.** The email only carries a link. The visitor
  types the new password directly on the website.
- The email tells users: "LIRC staff will never ask you for your password."

## How to test it (2 minutes)

1. Log out of the app. Open Home → Login → **Forgot?**
2. Type the email of a real account (for example your own admin account).
3. Check that Gmail (also check **Spam**). Click **Choose a new password**.
4. Type the new password twice and save. You should land on the dashboard.
5. Log out and log in again with the new password.
6. Open the same email link a second time → it politely says the link was
   already used.

## Notes and troubleshooting

- The link in the email points to the address stored in the function secret
  `SITE_URL`. If your website address changes, update it once with
  `supabase secrets set SITE_URL=https://your-site`.
- Local development: the emailed link goes to `SITE_URL` (the deployed site),
  not to `localhost`. This is normal for email links.
- Nothing arrived? Check the function logs in the Supabase dashboard
  (Edge Functions → `request-password-reset` → Logs), and wait 2 minutes
  between attempts (the cooldown is silent).
- The exact request used by the tests, if you ever need it:
  `POST /functions/v1/request-password-reset` with body `{"email":"..."}`.
