# How your API is protected (JWT explained simply)

Short version: **you already have JWT security** — it comes built into
Supabase, and it has been protecting every logged-in request in this app
since day one. This page shows you where it lives, how to see it with your
own eyes, and the simple rules for keeping it that way.

## What a JWT is

A JWT (JSON Web Token) is a **signed ID badge**. When you log in, Supabase
gives your browser a badge that lists who you are and when it expires.
Only Supabase can sign a valid badge, so nobody can fake one or edit their
role to "admin".

## The journey of one request

```
1. Log in            → Supabase Auth checks email + password
2. Badge issued      → app stores the badge (and a "refresh" badge)
3. Every request     → supabase-js automatically adds
                       `Authorization: Bearer <badge>` to the request
4. Supabase checks   → signature valid? expired? → role is `anon` (no badge)
                       or `authenticated` (valid badge)
5. Row Level Security → decides WHICH ROWS that role may touch
```

The badge is stored by `src/services/auth/authStorage.js`: local storage when
"Keep me logged in" is ticked, the current browser tab otherwise. When the
badge expires, supabase-js quietly uses the refresh badge to get a new one.

## See it yourself

1. Log in and press **F12** → **Network** tab.
2. Click any request to `/rest/v1/...` (for example search the OPAC).
3. Open **Request Headers** → look for `authorization: Bearer eyJ...`.
   That long text is your JWT badge.
4. Log out and repeat. Now Supabase answers **401** for private data — the
   badge is gone, so the door closes. That is the system working.

## Public vs protected endpoints

| Endpoint | Who gets in | Why |
| --- | --- | --- |
| Tables via `/rest/v1/...` | Badge + RLS rules per table | The catalog is readable by everyone; `usersData` returns only your own profile; attendance/enrollment only for staff |
| Files via `/storage/v1/...` | Badge + policies | Covers are viewable by all; only library staff (staff/librarian/admin) can upload |
| `register-user` function | Everyone (public) | Students register before they have an account. It never returns other people's data |
| `request-password-reset` function | Everyone (public) | Signed-out visitors ask for reset emails. Same generic reply for all, rate-limited, no data returned |
| `provision-accounts` function | Admins only | Creates personnel accounts end-to-end — a generated `LIB-####`, a generated password, the auth user + profile — and emails the credentials from the library Gmail. The function checks the caller's role itself |
| Any future function | **Badge required by default** (`verify_jwt = true`) | Unless you explicitly make it public like the two above |

## Template: a private, staff-only function

When you later build an endpoint that only staff may call, this is the
standard shape (put it in a new folder under `supabase/functions/`, then
`supabase functions deploy your-function`):

```ts
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "@supabase/supabase-js/cors";

Deno.serve(async (req) => {
  // 1. Read the caller's JWT from the request.
  const authHeader = req.headers.get("Authorization") ?? "";

  // 2. Ask Supabase Auth who this badge belongs to.
  const asCaller = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error } = await asCaller.auth.getUser();
  if (error || !user) {
    return new Response(JSON.stringify({ error: "Please log in." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 3. Check the role with the service client (the badge alone does not
  //    say "librarian" — the role lives in usersData).
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: profile } = await admin
    .from("usersData")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!["admin", "librarian"].includes(profile?.role)) {
    return new Response(JSON.stringify({ error: "Staff access required." }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 4. Do the work, then return data.
  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
```

Keep `verify_jwt = true` (the default) in `supabase/config.toml` for
functions like this — Supabase then rejects requests without a valid badge
before your code even runs. Step 3 above adds the role check on top.

## The rules that keep this safe

1. **Never** put the `service_role` key in the website (`VITE_` variables).
   It lives only in edge functions, where Supabase injects it automatically.
2. Row Level Security is the final authority. Even a valid badge sees only
   the rows its policies allow.
3. Public functions must assume the caller is a stranger: validate every
   input, return generic messages, reveal nothing about accounts.
4. Recommended one-time toggle: Supabase dashboard → Authentication →
   Passwords → enable **leaked password protection**, so known-breached
   passwords are rejected at registration and password reset.
5. When you see a **401** in testing, that is the security working — not a
   bug. 401 = no valid badge; 403 = valid badge, not enough permission.
6. **Never commit demo or live passwords.** The manual sample-account SQL now
   uses `CHANGE_ME_*` placeholders. Redacting a file does not remove it from git
   history: if a real password was ever committed, **rotate that account** (and
   rewrite history only with the team's agreement). The Supabase anon/publishable
   key is public by design; the service_role key, Vercel token and email app
   password must never be committed.
