// supabase/functions/registration/index.ts
//
// Public, token-based registration for existing library profiles.
//
//   request  email                         -> emails /register?token=...
//   verify   token                         -> { email, identity_verified }
//   match    token + library ID + name     -> attaches the matching usersData row
//   complete token + new password          -> creates the auth user, links the profile
//
// The raw token is only in the email; the database stores a SHA-256 hash.
// Passwords are never stored here - Supabase Auth hashes them.
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "@supabase/supabase-js/cors";
import nodemailer from "nodemailer";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const norm = (s: unknown) =>
  String(s ?? "").trim().replace(/\s+/g, " ").toLowerCase();
const normInitial = (s: unknown) =>
  String(s ?? "").replace(/[.\s]/g, "").toLowerCase().slice(0, 1);
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

const TOKEN_TTL_MS = 30 * 60 * 1000;
const RESEND_COOLDOWN_MS = 120 * 1000;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72;

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const siteUrl = (Deno.env.get("SITE_URL") ?? "").trim().replace(/\/+$/, "");
const gmailUser = Deno.env.get("GMAIL_USER")?.trim();
const gmailAppPassword = Deno.env.get("GMAIL_APP_PASSWORD")?.replace(/\s/g, "");

const admin = supabaseUrl && serviceKey
  ? createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  : null;

const mailer = gmailUser && gmailAppPassword
  ? nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    connectionTimeout: 10000,
    socketTimeout: 15000,
    auth: { user: gmailUser, pass: gmailAppPassword },
  })
  : null;

function passwordProblem(value: unknown) {
  const password = typeof value === "string" ? value : "";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Keep the password under ${MAX_PASSWORD_LENGTH} characters.`;
  }
  if (!/[a-z]/.test(password)) return "Add at least one lowercase letter.";
  if (!/[A-Z]/.test(password)) return "Add at least one uppercase letter.";
  if (!/\d/.test(password)) return "Add at least one number.";
  return "";
}

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function hashToken(raw: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function findToken(raw: unknown) {
  if (!admin || typeof raw !== "string" || raw.length < 20 || raw.length > 200) {
    return null;
  }
  const hash = await hashToken(raw);
  const { data, error } = await admin
    .from("registration_tokens")
    .select("id,email,profile_id,identity_verified_at,expires_at,used_at")
    .eq("token_hash", hash)
    .maybeSingle();
  if (error) {
    console.error("Couldn't read the registration token.", error);
    return null;
  }
  if (!data || data.used_at || Date.parse(data.expires_at) <= Date.now()) {
    return null;
  }
  return data;
}

const expired = () =>
  json(
    {
      error:
        "This registration link has expired or was already used. Request a new one.",
      code: "expired_link",
    },
    410,
  );

async function requestLink(body: Record<string, unknown>) {
  if (!mailer || !siteUrl) {
    console.error("Registration email is not configured (GMAIL/SITE_URL).");
    return json({ error: "Registration is temporarily unavailable." }, 503);
  }

  const email = typeof body.email === "string"
    ? body.email.trim().toLowerCase()
    : "";
  if (
    !email ||
    email.length > 254 ||
    !/^[^\s@]+@ccc\.edu\.ph$/.test(email)
  ) {
    return json({ error: "Use your CCC email." }, 400);
  }

  // Registration is only for people without an account. Do this before the
  // cooldown/email send so an existing account never receives a new link.
  const { data: alreadyRegistered, error: lookupError } = await admin!
    .rpc("lirc_email_has_account", { p_email: email });
  if (lookupError) {
    console.error("Couldn't check the registration email.", lookupError);
    return json({ error: "Registration is temporarily unavailable." }, 500);
  }
  if (alreadyRegistered) {
    return json(
      {
        error:
          "This email already has an account. Log in or reset your password.",
        code: "email_registered",
      },
      409,
    );
  }

  // Quiet cooldown: the visitor always gets the same reply.
  const { data: latest } = await admin!
    .from("registration_tokens")
    .select("created_at")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (
    latest?.created_at &&
    Date.now() - Date.parse(latest.created_at) < RESEND_COOLDOWN_MS
  ) {
    return json({ ok: true });
  }

  // A new link invalidates the previous unused link for this email.
  await admin!
    .from("registration_tokens")
    .delete()
    .eq("email", email)
    .is("used_at", null);

  // Housekeeping; the table only needs recent rows.
  await admin!
    .from("registration_tokens")
    .delete()
    .lt("expires_at", new Date(Date.now() - 7 * 86_400_000).toISOString());

  const raw = newToken();
  const hash = await hashToken(raw);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  const { data: inserted, error: insertError } = await admin!
    .from("registration_tokens")
    .insert({ email, token_hash: hash, expires_at: expiresAt })
    .select("id")
    .single();
  if (insertError || !inserted) {
    console.error("Couldn't create the registration token.", insertError);
    return json({ error: "Registration is temporarily unavailable." }, 500);
  }

  const link = `${siteUrl}/register?token=${encodeURIComponent(raw)}`;
  try {
    await mailer.sendMail({
      from: `"LIRC - City College of Calamba" <${gmailUser}>`,
      to: email,
      subject: "Finish your LIRC registration",
      text:
        `You asked to register your LIRC account.\n\n` +
        `Open this link to verify your library record and set your password:\n${link}\n\n` +
        `The link expires in 30 minutes and can be used once.\n` +
        `If you didn't ask, you can ignore this email.\n`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#0B1330">
          <h2 style="margin:0 0 8px">Finish your LIRC registration</h2>
          <p>You asked to register your LIRC account.</p>
          <p>Open this link to verify your library record and set your password:</p>
          <p style="margin:20px 0">
            <a href="${esc(link)}"
               style="background:#0B1330;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none">
               Verify and register</a>
          </p>
          <p style="color:#777;font-size:12px">Or paste this link into your browser:<br>
            <span style="word-break:break-all">${esc(link)}</span></p>
          <p style="color:#777;font-size:12px">The link expires in 30 minutes and can be used once.
            If you didn't ask, you can ignore this email.</p>
        </div>`,
    });
  } catch (error) {
    console.error("Registration email failed.", error);
    await admin!.from("registration_tokens").delete().eq("id", inserted.id);
    return json(
      { error: "We couldn't send the registration email. Please try again." },
      502,
    );
  }

  return json({ ok: true });
}

async function verify(body: Record<string, unknown>) {
  const token = await findToken(body.token);
  if (!token) return expired();
  return json({
    ok: true,
    email: token.email,
    identity_verified: Boolean(token.identity_verified_at),
  });
}

async function match(body: Record<string, unknown>) {
  const token = await findToken(body.token);
  if (!token) return expired();

  // The page may refresh after identity verification; keep the same token.
  if (token.identity_verified_at) {
    return json({ ok: true, email: token.email });
  }

  const first_name = norm(body.first_name);
  const surname = norm(body.surname);
  const middle_initial = normInitial(body.middle_initial);
  const library_id = norm(body.library_id).toUpperCase();
  if (!first_name || !surname || !middle_initial || !library_id) {
    return json(
      {
        error:
          "Enter your library ID, first name, surname and middle initial.",
        code: "record_mismatch",
      },
      400,
    );
  }

  const { data: profile, error } = await admin!
    .from("usersData")
    .select("id,first_name,surname,middle_initial,library_id,user_id")
    .eq("library_id", library_id)
    .maybeSingle();
  if (error) {
    console.error("Couldn't read the library profile.", error);
    return json({ error: "Registration is temporarily unavailable." }, 500);
  }

  const mismatch = json(
    {
      error:
        "We couldn't match those details to a library card. Check your first name, surname, middle initial, and library ID.",
      code: "record_mismatch",
    },
    404,
  );
  if (!profile) return mismatch;
  if (
    norm(profile.first_name) !== first_name ||
    norm(profile.surname) !== surname ||
    normInitial(profile.middle_initial) !== middle_initial
  ) {
    return mismatch;
  }
  if (profile.user_id) {
    return json(
      {
        error:
          "This library card already has an account. Log in or reset your password.",
        code: "already_registered",
      },
      409,
    );
  }

  const { error: updateError } = await admin!
    .from("registration_tokens")
    .update({
      profile_id: profile.id,
      identity_verified_at: new Date().toISOString(),
    })
    .eq("id", token.id)
    .is("used_at", null)
    .is("profile_id", null);
  if (updateError) {
    console.error("Couldn't attach the profile to the token.", updateError);
    return json({ error: "Registration is temporarily unavailable." }, 500);
  }

  return json({
    ok: true,
    email: token.email,
    library_id: profile.library_id,
  });
}

async function complete(body: Record<string, unknown>) {
  const problem = passwordProblem(body.password);
  if (problem) return json({ error: problem, code: "weak_password" }, 400);

  const token = await findToken(body.token);
  if (!token) return expired();
  if (!token.profile_id || !token.identity_verified_at) {
    return json(
      { error: "Verify your library record before setting a password." },
      409,
    );
  }

  const { data: profile, error: profileError } = await admin!
    .from("usersData")
    .select("id,first_name,surname,library_id,user_id")
    .eq("id", token.profile_id)
    .maybeSingle();
  if (profileError || !profile) {
    console.error("Couldn't read the linked profile.", profileError);
    return json({ error: "Registration is temporarily unavailable." }, 500);
  }
  if (profile.user_id) {
    return json(
      {
        error:
          "This library card already has an account. Log in or reset your password.",
        code: "already_registered",
      },
      409,
    );
  }

  const { data: created, error: createError } = await admin!.auth.admin
    .createUser({
      email: token.email,
      password: String(body.password),
      email_confirm: true, // the email link itself proves the address
      user_metadata: {
        library_id: profile.library_id,
        first_name: profile.first_name,
        surname: profile.surname,
      },
    });
  if (createError || !created.user) {
    const taken = /already|registered|exists/i.test(createError?.message ?? "");
    return json(
      {
        error: taken
          ? "That CCC email already has an account. Log in or reset your password."
          : "Couldn't create your account. Please try again.",
        code: taken ? "email_in_use" : "create_failed",
      },
      taken ? 409 : 500,
    );
  }

  const { data: linked, error: linkError } = await admin!
    .from("usersData")
    .update({ user_id: created.user.id })
    .eq("id", profile.id)
    .is("user_id", null)
    .select("id");
  if (linkError || !linked?.length) {
    console.error("Couldn't link the new account.", linkError);
    await admin!.auth.admin.deleteUser(created.user.id);
    return json({ error: "Registration is temporarily unavailable." }, 500);
  }

  const { error: usedError } = await admin!
    .from("registration_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", token.id);
  if (usedError) console.error("Couldn't close the registration token.", usedError);

  return json({
    ok: true,
    email: token.email,
    library_id: profile.library_id,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!admin) {
    console.error("Registration is not configured (Supabase admin client).");
    return json({ error: "Registration is temporarily unavailable." }, 503);
  }

  let payload: unknown;
  try {
    const text = await req.text();
    if (text.length > 8192) return json({ error: "Request is too large." }, 413);
    payload = JSON.parse(text);
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return json({ error: "Invalid request." }, 400);
  }
  const body = payload as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "";

  switch (action) {
    case "request":
      return requestLink(body);
    case "verify":
      return verify(body);
    case "match":
      return match(body);
    case "complete":
      return complete(body);
    default:
      return json({ error: "Invalid registration action." }, 400);
  }
});
